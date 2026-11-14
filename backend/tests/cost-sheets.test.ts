import { describe, expect, it } from 'vitest';
import {
  api,
  createBooking,
  createCostSheet,
  createCustomer,
  expectError,
  unitId,
} from './helpers/test-helpers.js';

describe('Cost sheet discount calculation', () => {
  it('previews the assignment example without saving anything', async () => {
    const response = await api.post('/api/cost-sheets/preview').send({ unit_id: await unitId('RN-101'), discount_bps: 100 });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      unit_code: 'RN-101',
      listed_price_paise: 680000000,
      discount_bps: 100,
      discount_amount_paise: 6800000,
      final_price_paise: 673200000,
    });
    expect((await api.get('/api/cost-sheets')).body.pagination.total).toBe(0);
  });

  it('saves the assignment example: RN-101 at 1% is Rs 68,000 off and Rs 67,32,000 final', async () => {
    const customer = await createCustomer({ full_name: 'Asha Verma' });
    const costSheet = await createCostSheet({ unitCode: 'RN-101', discountBps: 100, customerId: customer.id });
    expect(costSheet).toMatchObject({
      listed_price_paise: 680000000,
      discount_bps: 100,
      discount_amount_paise: 6800000,
      final_price_paise: 673200000,
      unit_code: 'RN-101',
      project_name: 'Rohan Nest',
      customer_name: 'Asha Verma',
      price_changed: false,
      price_difference_paise: 0,
      quotation_count: 0,
    });
    expect(costSheet.cost_sheet_number).toMatch(/^CS-\d{4}-0001$/);
  });

  it('accepts the two ends of the range, 0% and 2%', async () => {
    expect((await createCostSheet({ discountBps: 0 })).final_price_paise).toBe(680000000);
    expect((await createCostSheet({ discountBps: 200 })).final_price_paise).toBe(666400000);
  });

  it('accepts a fractional percentage such as 1.25% (125 basis points)', async () => {
    const costSheet = await createCostSheet({ discountBps: 125 });
    expect(costSheet.discount_amount_paise).toBe(8500000);
    expect(costSheet.final_price_paise).toBe(671500000);
  });

  it('rejects a discount outside 0% to 2%, or one that is not a whole number of basis points', async () => {
    const customer = await createCustomer();
    const unit = await unitId('RN-101');
    for (const discount of [201, 300, -1, 100.5, '100', null, undefined]) {
      const response = await api.post('/api/cost-sheets').send({ unit_id: unit, customer_id: customer.id, discount_bps: discount });
      expectError(response, 400, 'VALIDATION_ERROR');
      expectError(await api.post('/api/cost-sheets/preview').send({ unit_id: unit, discount_bps: discount }), 400, 'VALIDATION_ERROR');
    }
  });

  it('ignores any price sent by the client and always uses the unit price from the database', async () => {
    const customer = await createCustomer();
    const response = await api.post('/api/cost-sheets').send({
      unit_id: await unitId('RN-101'),
      customer_id: customer.id,
      discount_bps: 100,
      listed_price_paise: 1,
      final_price_paise: 1,
    });
    expect(response.status).toBe(201);
    expect(response.body.data.listed_price_paise).toBe(680000000);
    expect(response.body.data.final_price_paise).toBe(673200000);
  });
});

describe('Saved cost sheets', () => {
  it('keep their price and discount when the unit price changes later, and show the difference', async () => {
    const saved = await createCostSheet({ unitCode: 'RN-101', discountBps: 100 });
    await api.patch(`/api/units/${saved.unit_id}/price`).send({ listed_price_paise: 700000000 });

    const response = await api.get(`/api/cost-sheets/${saved.id}`);
    expect(response.body.data).toMatchObject({
      listed_price_paise: 680000000,
      discount_amount_paise: 6800000,
      final_price_paise: 673200000,
      current_listed_price_paise: 700000000,
      price_changed: true,
      price_difference_paise: 20000000,
    });
  });

  it('a new cost sheet after a price change uses the new price', async () => {
    const first = await createCostSheet({ unitCode: 'RN-101', discountBps: 100 });
    await api.patch(`/api/units/${first.unit_id}/price`).send({ listed_price_paise: 700000000 });
    const second = await createCostSheet({ unitCode: 'RN-101', discountBps: 100, customerId: first.customer_id });
    expect(second.listed_price_paise).toBe(700000000);
    expect(second.final_price_paise).toBe(693000000);
  });

  it('allows many cost sheets for the same unit and customer, each with its own number', async () => {
    const customer = await createCustomer();
    const first = await createCostSheet({ customerId: customer.id, discountBps: 50 });
    const second = await createCostSheet({ customerId: customer.id, discountBps: 150 });
    expect(first.cost_sheet_number).not.toBe(second.cost_sheet_number);

    const list = await api.get('/api/cost-sheets').query({ customer_id: customer.id });
    expect(list.body.pagination.total).toBe(2);
    expect(list.body.data[0].id).toBe(second.id);
  });

  it('cannot be edited: there is no update endpoint', async () => {
    const costSheet = await createCostSheet();
    expectError(await api.patch(`/api/cost-sheets/${costSheet.id}`).send({ discount_bps: 0 }), 404, 'ROUTE_NOT_FOUND');
    expectError(await api.put(`/api/cost-sheets/${costSheet.id}`).send({ discount_bps: 0 }), 404, 'ROUTE_NOT_FOUND');
  });

  it('can be deleted while no quotation exists', async () => {
    const costSheet = await createCostSheet();
    expect((await api.delete(`/api/cost-sheets/${costSheet.id}`)).status).toBe(204);
    expectError(await api.get(`/api/cost-sheets/${costSheet.id}`), 404, 'COST_SHEET_NOT_FOUND');
  });

  it('cannot be deleted once a quotation has been created from it', async () => {
    const costSheet = await createCostSheet();
    await api.post('/api/quotations').send({ cost_sheet_id: costSheet.id });
    expectError(await api.delete(`/api/cost-sheets/${costSheet.id}`), 409, 'COST_SHEET_HAS_QUOTATIONS');
    expect((await api.get(`/api/cost-sheets/${costSheet.id}`)).body.data.quotation_count).toBe(1);
  });
});

describe('Creating a cost sheet is blocked when', () => {
  it('the unit or the customer does not exist', async () => {
    const customer = await createCustomer();
    expectError(
      await api.post('/api/cost-sheets').send({ unit_id: 999999, customer_id: customer.id, discount_bps: 100 }),
      404,
      'UNIT_NOT_FOUND',
    );
    expectError(
      await api.post('/api/cost-sheets').send({ unit_id: await unitId('RN-101'), customer_id: 999999, discount_bps: 100 }),
      404,
      'CUSTOMER_NOT_FOUND',
    );
  });

  it('the unit is no longer Available', async () => {
    const booking = await createBooking({ unitCode: 'RN-101' });
    const response = await api
      .post('/api/cost-sheets')
      .send({ unit_id: booking.unit_id, customer_id: booking.customer_id, discount_bps: 100 });
    expectError(response, 409, 'UNIT_NOT_AVAILABLE');
    expectError(await api.post('/api/cost-sheets/preview').send({ unit_id: booking.unit_id, discount_bps: 100 }), 409, 'UNIT_NOT_AVAILABLE');
  });
});
