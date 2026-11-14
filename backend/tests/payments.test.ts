import { describe, expect, it } from 'vitest';
import { api, countRows, createBooking, expectError, pay, today, unitStatus } from './helpers/test-helpers.js';

interface MilestoneJson {
  stage: string;
  collected_paise: number;
  balance_paise: number;
  state: string;
  is_current: boolean;
}

const milestone = (booking: { milestones: MilestoneJson[] }, stage: string): MilestoneJson =>
  booking.milestones.find((m) => m.stage === stage) as MilestoneJson;

describe('The calculation example from the assignment', () => {
  it('after Rs 5,00,000 against Booking: outstanding is Rs 62,32,000 and the Booking balance is Rs 1,73,200', async () => {
    const booking = await createBooking({ unitCode: 'RN-101', discountBps: 100 });

    const response = await api.post(`/api/bookings/${booking.id}/payments`).send({
      amount_paise: 50000000,
      payment_date: today(),
      payment_reference: 'UTR-EXAMPLE-1',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.payment).toMatchObject({
      stage: 'BOOKING',
      sequence_no: 1,
      amount_paise: 50000000,
      payment_date: today(),
      payment_reference: 'UTR-EXAMPLE-1',
    });
    const after = response.body.data.booking;
    expect(after.final_price_paise).toBe(673200000);
    expect(after.collected_paise).toBe(50000000);
    expect(after.outstanding_paise).toBe(623200000);
    expect(milestone(after, 'BOOKING')).toMatchObject({
      collected_paise: 50000000,
      balance_paise: 17320000,
      state: 'PARTLY_PAID',
      is_current: true,
    });
    expect(after.payments).toHaveLength(1);
  });
});

describe('Overpayments', () => {
  it('rejects an amount larger than the current milestone balance, and saves nothing', async () => {
    const booking = await createBooking();
    await pay(booking.id, 50000000);

    const response = await pay(booking.id, 20000000);

    expectError(response, 409, 'OVERPAYMENT');
    expect(response.body.error.message).toBe('The Booking milestone has ₹1,73,200 remaining. Enter ₹1,73,200 or less.');
    expect(response.body.error.details[0].field).toBe('amount_paise');
    expect(await countRows('payments')).toBe(1);
    expect((await api.get(`/api/bookings/${booking.id}`)).body.data.outstanding_paise).toBe(623200000);
  });

  it('rejects an amount one paise above the balance, and accepts the exact balance', async () => {
    const booking = await createBooking();
    expectError(await pay(booking.id, 67320001), 409, 'OVERPAYMENT');

    const exact = await pay(booking.id, 67320000);
    expect(exact.status).toBe(201);
    expect(milestone(exact.body.data.booking, 'BOOKING')).toMatchObject({ balance_paise: 0, state: 'PAID', is_current: false });
    expect(milestone(exact.body.data.booking, 'FOUNDATION')).toMatchObject({ state: 'PENDING', is_current: true });
  });

  it('does not let two simultaneous payments overpay a milestone together', async () => {
    const booking = await createBooking();

    const responses = await Promise.all([pay(booking.id, 67320000), pay(booking.id, 67320000)]);

    // Both are valid on their own. Handled one after the other, the first fills Booking
    // and the second goes to Foundation: nothing is ever overpaid.
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const after = (await api.get(`/api/bookings/${booking.id}`)).body.data;
    expect(milestone(after, 'BOOKING').balance_paise).toBe(0);
    expect(milestone(after, 'FOUNDATION').collected_paise).toBe(67320000);
    expect(after.collected_paise).toBe(134640000);
  });

  it('never lets total collections exceed the final price under simultaneous payments', async () => {
    const booking = await createBooking();
    await pay(booking.id, 67320000);
    await pay(booking.id, 134640000);
    await pay(booking.id, 201960000);

    // Handover has Rs 26,92,800 left. Three people try to pay all of it at the same moment.
    const responses = await Promise.all([
      pay(booking.id, 269280000),
      pay(booking.id, 269280000),
      pay(booking.id, 269280000),
    ]);

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.body.error?.code === 'BOOKING_FULLY_PAID')).toHaveLength(2);
    const after = (await api.get(`/api/bookings/${booking.id}`)).body.data;
    expect(after.collected_paise).toBe(673200000);
    expect(after.outstanding_paise).toBe(0);
  });
});

describe('Duplicate payment references', () => {
  it('rejects a reference that was already recorded', async () => {
    const booking = await createBooking();
    expect((await pay(booking.id, 1000000, 'UTR1001')).status).toBe(201);

    const duplicate = await pay(booking.id, 1000000, 'UTR1001');

    expectError(duplicate, 409, 'DUPLICATE_PAYMENT_REFERENCE');
    expect(duplicate.body.error.details[0].field).toBe('payment_reference');
    expect(await countRows('payments')).toBe(1);
  });

  it('treats references as the same regardless of capitals and surrounding spaces', async () => {
    const booking = await createBooking();
    const first = await pay(booking.id, 1000000, 'utr1001');
    expect(first.body.data.payment.payment_reference).toBe('UTR1001');
    expectError(await pay(booking.id, 1000000, '  UTR1001  '), 409, 'DUPLICATE_PAYMENT_REFERENCE');
    expectError(await pay(booking.id, 1000000, 'Utr1001'), 409, 'DUPLICATE_PAYMENT_REFERENCE');
  });

  it('rejects a reference already used on a different booking', async () => {
    const first = await createBooking({ unitCode: 'RN-101' });
    const second = await createBooking({ unitCode: 'RC-101' });
    await pay(first.id, 1000000, 'UTR1001');
    expectError(await pay(second.id, 1000000, 'UTR1001'), 409, 'DUPLICATE_PAYMENT_REFERENCE');
  });

  it('lets exactly one of two simultaneous payments with the same reference succeed', async () => {
    const first = await createBooking({ unitCode: 'RN-101' });
    const second = await createBooking({ unitCode: 'RC-101' });

    const responses = await Promise.all([pay(first.id, 1000000, 'UTR1001'), pay(second.id, 1000000, 'UTR1001')]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.status === 409)?.body.error.code).toBe('DUPLICATE_PAYMENT_REFERENCE');
    expect(await countRows('payments')).toBe(1);
  });
});

describe('Invalid payments', () => {
  it('rejects an amount that is zero, negative, fractional, text or missing', async () => {
    const booking = await createBooking();
    for (const amount of [0, -100, 100.5, '50000', null, undefined]) {
      const response = await api
        .post(`/api/bookings/${booking.id}/payments`)
        .send({ amount_paise: amount, payment_date: today(), payment_reference: 'UTR-INVALID' });
      expectError(response, 400, 'VALIDATION_ERROR');
    }
    expect(await countRows('payments')).toBe(0);
  });

  it('rejects a date that is in the future, not real, badly formatted or missing', async () => {
    const booking = await createBooking();
    for (const date of ['2999-01-01', '2026-02-30', '14-11-2026', '2026/11/14', '', undefined]) {
      const response = await api
        .post(`/api/bookings/${booking.id}/payments`)
        .send({ amount_paise: 1000000, payment_date: date, payment_reference: 'UTR-INVALID' });
      expectError(response, 400, 'VALIDATION_ERROR');
    }
  });

  it('accepts a date in the past', async () => {
    const booking = await createBooking();
    const response = await api
      .post(`/api/bookings/${booking.id}/payments`)
      .send({ amount_paise: 1000000, payment_date: '2026-01-15', payment_reference: 'UTR-PAST' });
    expect(response.status).toBe(201);
    expect(response.body.data.payment.payment_date).toBe('2026-01-15');
  });

  it('rejects a reference that is blank, too long or missing', async () => {
    const booking = await createBooking();
    for (const reference of ['', '   ', 'X'.repeat(51), undefined]) {
      const response = await api
        .post(`/api/bookings/${booking.id}/payments`)
        .send({ amount_paise: 1000000, payment_date: today(), payment_reference: reference });
      expectError(response, 400, 'VALIDATION_ERROR');
    }
  });

  it('answers 404 for a booking that does not exist', async () => {
    expectError(await pay(999999, 1000000), 404, 'BOOKING_NOT_FOUND');
  });
});

describe('Milestones are paid in order', () => {
  it('sends each payment to the earliest milestone that still has a balance', async () => {
    const booking = await createBooking();

    const first = await pay(booking.id, 67320000);
    expect(first.body.data.payment.stage).toBe('BOOKING');

    const second = await pay(booking.id, 100000000);
    expect(second.body.data.payment.stage).toBe('FOUNDATION');
    expect(milestone(second.body.data.booking, 'FOUNDATION')).toMatchObject({
      collected_paise: 100000000,
      balance_paise: 34640000,
      state: 'PARTLY_PAID',
      is_current: true,
    });
    expect(milestone(second.body.data.booking, 'STRUCTURE')).toMatchObject({ state: 'PENDING', is_current: false });
  });

  it('shows the payment history newest first, with the milestone each payment went to', async () => {
    const booking = await createBooking();
    await pay(booking.id, 67320000, 'FIRST');
    await pay(booking.id, 1000000, 'SECOND');
    const history = (await api.get(`/api/bookings/${booking.id}`)).body.data.payments;
    expect(history.map((p: { payment_reference: string; stage: string }) => [p.payment_reference, p.stage])).toEqual([
      ['SECOND', 'FOUNDATION'],
      ['FIRST', 'BOOKING'],
    ]);
  });
});

describe('Paying a booking in full', () => {
  it('marks the unit Sold when the last rupee is paid, and then refuses further payments', async () => {
    const booking = await createBooking({ unitCode: 'RN-101' });
    await pay(booking.id, 67320000);
    await pay(booking.id, 134640000);
    await pay(booking.id, 201960000);
    expect(await unitStatus('RN-101')).toBe('BOOKED');

    const last = await pay(booking.id, 269280000);

    expect(last.status).toBe(201);
    expect(last.body.data.booking).toMatchObject({ collected_paise: 673200000, outstanding_paise: 0, unit_status: 'SOLD' });
    expect(last.body.data.booking.milestones.every((m: MilestoneJson) => m.state === 'PAID' && !m.is_current)).toBe(true);
    expect(await unitStatus('RN-101')).toBe('SOLD');

    expectError(await pay(booking.id, 100), 409, 'BOOKING_FULLY_PAID');
  });
});
