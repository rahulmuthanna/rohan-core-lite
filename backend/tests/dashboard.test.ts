import { describe, expect, it } from 'vitest';
import { api, createAcceptedQuotation, createBooking, pay } from './helpers/test-helpers.js';

describe('Dashboard', () => {
  it('shows 12 available units and zero money on a fresh database', async () => {
    const response = await api.get('/api/dashboard');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      units: { total: 12, available: 12, booked: 0, sold: 0 },
      bookings_count: 0,
      booking_value_paise: 0,
      collected_paise: 0,
      outstanding_paise: 0,
    });
    expect(response.body.data.by_project).toHaveLength(4);
  });

  it('reflects the assignment example after one booking and one payment', async () => {
    const booking = await createBooking({ unitCode: 'RN-101', discountBps: 100 });
    await pay(booking.id, 50000000);

    const response = await api.get('/api/dashboard');
    expect(response.body.data).toMatchObject({
      units: { total: 12, available: 11, booked: 1, sold: 0 },
      bookings_count: 1,
      booking_value_paise: 673200000,
      collected_paise: 50000000,
      outstanding_paise: 623200000,
    });
    const nest = response.body.data.by_project.find((p: { project_name: string }) => p.project_name === 'Rohan Nest');
    expect(nest).toMatchObject({ total: 3, available: 2, booked: 1, sold: 0 });
  });

  it('counts only bookings, not quotations that were merely accepted', async () => {
    await createAcceptedQuotation({ unitCode: 'RN-101' });
    const response = await api.get('/api/dashboard');
    expect(response.body.data.booking_value_paise).toBe(0);
    expect(response.body.data.units.available).toBe(12);
  });

  it('adds up several bookings and counts a fully paid unit as Sold', async () => {
    const first = await createBooking({ unitCode: 'RN-101', discountBps: 100 });
    await createBooking({ unitCode: 'RC-101', discountBps: 0 });
    for (const amount of [67320000, 134640000, 201960000, 269280000]) {
      await pay(first.id, amount);
    }

    const response = await api.get('/api/dashboard');
    expect(response.body.data).toMatchObject({
      units: { total: 12, available: 10, booked: 1, sold: 1 },
      bookings_count: 2,
      booking_value_paise: 673200000 + 450000000,
      collected_paise: 673200000,
      outstanding_paise: 450000000,
    });
  });
});
