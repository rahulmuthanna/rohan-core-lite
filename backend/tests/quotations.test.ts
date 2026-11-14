import { describe, expect, it } from 'vitest';
import {
  api,
  backdateQuotation,
  createAcceptedQuotation,
  createBooking,
  createCostSheet,
  createDraftQuotation,
  expectError,
  today,
} from './helpers/test-helpers.js';

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

describe('Creating a quotation', () => {
  it('starts as Draft, issued today, valid for 7 days, with the money of its cost sheet', async () => {
    const costSheet = await createCostSheet({ unitCode: 'RN-101', discountBps: 100 });
    const response = await api.post('/api/quotations').send({ cost_sheet_id: costSheet.id });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      status: 'DRAFT',
      issue_date: today(),
      valid_until: addDays(today(), 7),
      cost_sheet_id: costSheet.id,
      listed_price_paise: 680000000,
      discount_bps: 100,
      discount_amount_paise: 6800000,
      final_price_paise: 673200000,
      unit_code: 'RN-101',
      customer_id: costSheet.customer_id,
      booking_id: null,
    });
    expect(response.body.data.quotation_number).toMatch(/^QT-\d{4}-0001$/);
  });

  it('gives every quotation a unique number, and allows several from one cost sheet', async () => {
    const costSheet = await createCostSheet();
    const first = await api.post('/api/quotations').send({ cost_sheet_id: costSheet.id });
    const second = await api.post('/api/quotations').send({ cost_sheet_id: costSheet.id });
    expect(second.status).toBe(201);
    expect(first.body.data.quotation_number).not.toBe(second.body.data.quotation_number);
  });

  it('answers 404 for a cost sheet that does not exist', async () => {
    expectError(await api.post('/api/quotations').send({ cost_sheet_id: 999999 }), 404, 'COST_SHEET_NOT_FOUND');
  });

  it('keeps its original money when the unit price changes later', async () => {
    const quotation = await createDraftQuotation({ unitCode: 'RN-101', discountBps: 100 });
    await api.patch(`/api/units/${quotation.unit_id}/price`).send({ listed_price_paise: 900000000 });
    const response = await api.get(`/api/quotations/${quotation.id}`);
    expect(response.body.data).toMatchObject({
      listed_price_paise: 680000000,
      discount_amount_paise: 6800000,
      final_price_paise: 673200000,
    });
  });
});

describe('Quotation status', () => {
  it('moves Draft -> Sent -> Accepted', async () => {
    const quotation = await createDraftQuotation();
    const sent = await api.post(`/api/quotations/${quotation.id}/send`);
    expect(sent.body.data.status).toBe('SENT');
    const accepted = await api.post(`/api/quotations/${quotation.id}/accept`);
    expect(accepted.body.data.status).toBe('ACCEPTED');
  });

  it('cannot skip a step: a Draft cannot be accepted', async () => {
    const quotation = await createDraftQuotation();
    expectError(await api.post(`/api/quotations/${quotation.id}/accept`), 409, 'INVALID_STATUS_TRANSITION');
  });

  it('cannot go backwards or repeat a step', async () => {
    const quotation = await createAcceptedQuotation();
    expectError(await api.post(`/api/quotations/${quotation.id}/send`), 409, 'INVALID_STATUS_TRANSITION');
    expectError(await api.post(`/api/quotations/${quotation.id}/accept`), 409, 'INVALID_STATUS_TRANSITION');
  });

  it('answers 404 for a quotation that does not exist', async () => {
    expectError(await api.post('/api/quotations/999999/send'), 404, 'QUOTATION_NOT_FOUND');
    expectError(await api.get('/api/quotations/999999'), 404, 'QUOTATION_NOT_FOUND');
  });

  it('can be filtered by status in the list', async () => {
    const draft = await createDraftQuotation({ unitCode: 'RN-101' });
    const accepted = await createAcceptedQuotation({ unitCode: 'RN-201' });
    const ids = async (status: string) =>
      (await api.get('/api/quotations').query({ status })).body.data.map((q: { id: number }) => q.id);
    expect(await ids('DRAFT')).toEqual([draft.id]);
    expect(await ids('ACCEPTED')).toEqual([accepted.id]);
    expect(await ids('SENT')).toEqual([]);
    expectError(await api.get('/api/quotations?status=CANCELLED'), 400, 'VALIDATION_ERROR');
  });
});

describe('Quotation expiry', () => {
  it('is still valid on the last day of its 7 days', async () => {
    const quotation = await createDraftQuotation();
    await backdateQuotation(quotation.id, 7);
    const response = await api.get(`/api/quotations/${quotation.id}`);
    expect(response.body.data.valid_until).toBe(today());
    expect(response.body.data.status).toBe('DRAFT');
    expect((await api.post(`/api/quotations/${quotation.id}/send`)).status).toBe(200);
  });

  it('shows as Expired from the day after its validity ends, whatever its status was', async () => {
    const draft = await createDraftQuotation({ unitCode: 'RN-101' });
    const accepted = await createAcceptedQuotation({ unitCode: 'RN-201' });
    await backdateQuotation(draft.id, 8);
    await backdateQuotation(accepted.id, 8);

    expect((await api.get(`/api/quotations/${draft.id}`)).body.data.status).toBe('EXPIRED');
    expect((await api.get(`/api/quotations/${accepted.id}`)).body.data.status).toBe('EXPIRED');

    const expiredList = await api.get('/api/quotations').query({ status: 'EXPIRED' });
    expect(expiredList.body.pagination.total).toBe(2);
    expect((await api.get('/api/quotations').query({ status: 'ACCEPTED' })).body.pagination.total).toBe(0);
  });

  it('cannot change status once expired', async () => {
    const draft = await createDraftQuotation();
    await backdateQuotation(draft.id, 8);
    expectError(await api.post(`/api/quotations/${draft.id}/send`), 409, 'QUOTATION_EXPIRED');
    expectError(await api.post(`/api/quotations/${draft.id}/accept`), 409, 'QUOTATION_EXPIRED');
  });

  it('cannot be booked once expired, even if it was Accepted', async () => {
    const accepted = await createAcceptedQuotation();
    await backdateQuotation(accepted.id, 8);
    expectError(await api.post('/api/bookings').send({ quotation_id: accepted.id }), 409, 'QUOTATION_EXPIRED');
  });

  it('never expires once it has been booked', async () => {
    const booking = await createBooking();
    await backdateQuotation(booking.quotation_id, 30);
    const response = await api.get(`/api/quotations/${booking.quotation_id}`);
    expect(response.body.data.status).toBe('ACCEPTED');
    expect(response.body.data.booking_number).toBe(booking.booking_number);
  });

  it('can be replaced by a fresh quotation from the same cost sheet', async () => {
    const expired = await createDraftQuotation();
    await backdateQuotation(expired.id, 8);
    const fresh = await api.post('/api/quotations').send({ cost_sheet_id: expired.cost_sheet_id });
    expect(fresh.status).toBe(201);
    expect(fresh.body.data.status).toBe('DRAFT');
  });
});

describe('Quotations for a unit that is no longer Available', () => {
  it('cannot be created, sent or accepted', async () => {
    const draft = await createDraftQuotation({ unitCode: 'RN-101' });
    const sent = await createDraftQuotation({ unitCode: 'RN-101' });
    await api.post(`/api/quotations/${sent.id}/send`);
    await createBooking({ unitCode: 'RN-101' });

    expectError(await api.post('/api/quotations').send({ cost_sheet_id: draft.cost_sheet_id }), 409, 'UNIT_NOT_AVAILABLE');
    expectError(await api.post(`/api/quotations/${draft.id}/send`), 409, 'UNIT_NOT_AVAILABLE');
    expectError(await api.post(`/api/quotations/${sent.id}/accept`), 409, 'UNIT_NOT_AVAILABLE');
  });

  it('can still be viewed, and report the unit status', async () => {
    const draft = await createDraftQuotation({ unitCode: 'RN-101' });
    await createBooking({ unitCode: 'RN-101' });
    const response = await api.get(`/api/quotations/${draft.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.unit_status).toBe('BOOKED');
  });
});
