import { describe, expect, it } from 'vitest';
import {
  api,
  countRows,
  createAcceptedQuotation,
  createBooking,
  createDraftQuotation,
  expectError,
  unitStatus,
} from './helpers/test-helpers.js';

describe('Creating a booking', () => {
  it('books the unit and creates the four milestones of the assignment example', async () => {
    const quotation = await createAcceptedQuotation({ unitCode: 'RN-101', discountBps: 100 });
    const response = await api.post('/api/bookings').send({ quotation_id: quotation.id });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      quotation_id: quotation.id,
      unit_code: 'RN-101',
      unit_status: 'BOOKED',
      final_price_paise: 673200000,
      collected_paise: 0,
      outstanding_paise: 673200000,
      payments: [],
    });
    expect(response.body.data.booking_number).toMatch(/^BK-\d{4}-0001$/);
    expect(
      response.body.data.milestones.map((m: Record<string, unknown>) => [m.sequence_no, m.stage, m.percent, m.amount_due_paise]),
    ).toEqual([
      [1, 'BOOKING', 10, 67320000],
      [2, 'FOUNDATION', 20, 134640000],
      [3, 'STRUCTURE', 30, 201960000],
      [4, 'HANDOVER', 40, 269280000],
    ]);
    expect(response.body.data.milestones.map((m: { state: string }) => m.state)).toEqual([
      'PENDING',
      'PENDING',
      'PENDING',
      'PENDING',
    ]);
    expect(response.body.data.milestones.map((m: { is_current: boolean }) => m.is_current)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(await unitStatus('RN-101')).toBe('BOOKED');
  });

  it('is rejected for a Draft or Sent quotation', async () => {
    const draft = await createDraftQuotation({ unitCode: 'RN-101' });
    expectError(await api.post('/api/bookings').send({ quotation_id: draft.id }), 409, 'QUOTATION_NOT_ACCEPTED');
    await api.post(`/api/quotations/${draft.id}/send`);
    expectError(await api.post('/api/bookings').send({ quotation_id: draft.id }), 409, 'QUOTATION_NOT_ACCEPTED');
    expect(await unitStatus('RN-101')).toBe('AVAILABLE');
  });

  it('answers 404 for a quotation that does not exist, and 400 for a bad id', async () => {
    expectError(await api.post('/api/bookings').send({ quotation_id: 999999 }), 404, 'QUOTATION_NOT_FOUND');
    expectError(await api.post('/api/bookings').send({ quotation_id: 'abc' }), 400, 'VALIDATION_ERROR');
  });

  it('appears in the list and can be opened', async () => {
    const booking = await createBooking({ unitCode: 'RN-101' });
    const list = await api.get('/api/bookings');
    expect(list.body.pagination.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ id: booking.id, unit_code: 'RN-101', outstanding_paise: 673200000 });
    expect((await api.get(`/api/bookings/${booking.id}`)).body.data.milestones).toHaveLength(4);
    expectError(await api.get('/api/bookings/999999'), 404, 'BOOKING_NOT_FOUND');
  });
});

describe('Duplicate bookings', () => {
  it('rejects using the same quotation twice', async () => {
    const booking = await createBooking({ unitCode: 'RN-101' });
    const again = await api.post('/api/bookings').send({ quotation_id: booking.quotation_id });
    expectError(again, 409, 'QUOTATION_ALREADY_BOOKED');
    expect(await countRows('bookings')).toBe(1);
  });

  it('rejects a second booking of the same unit through a different accepted quotation', async () => {
    const first = await createAcceptedQuotation({ unitCode: 'RN-101' });
    const second = await createAcceptedQuotation({ unitCode: 'RN-101' });

    expect((await api.post('/api/bookings').send({ quotation_id: first.id })).status).toBe(201);
    expectError(await api.post('/api/bookings').send({ quotation_id: second.id }), 409, 'UNIT_NOT_AVAILABLE');
    expect(await countRows('bookings')).toBe(1);
    expect(await countRows('payment_milestones')).toBe(4);
  });

  it('lets exactly one of two simultaneous requests for the same unit succeed', async () => {
    const first = await createAcceptedQuotation({ unitCode: 'RN-101' });
    const second = await createAcceptedQuotation({ unitCode: 'RN-101' });

    const responses = await Promise.all([
      api.post('/api/bookings').send({ quotation_id: first.id }),
      api.post('/api/bookings').send({ quotation_id: second.id }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const rejected = responses.find((response) => response.status === 409);
    expect(rejected?.body.error.code).toBe('UNIT_NOT_AVAILABLE');
    expect(await countRows('bookings')).toBe(1);
    expect(await countRows('payment_milestones')).toBe(4);
    expect(await unitStatus('RN-101')).toBe('BOOKED');
  });

  it('lets exactly one of five simultaneous requests for the same quotation succeed', async () => {
    const quotation = await createAcceptedQuotation({ unitCode: 'RN-101' });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => api.post('/api/bookings').send({ quotation_id: quotation.id })),
    );

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(4);
    expect(await countRows('bookings')).toBe(1);
    expect(await countRows('payment_milestones')).toBe(4);
  });

  it('leaves other units free to be booked', async () => {
    await createBooking({ unitCode: 'RN-101' });
    await createBooking({ unitCode: 'RC-101' });
    expect(await countRows('bookings')).toBe(2);
    expect(await unitStatus('RN-201')).toBe('AVAILABLE');
  });
});
