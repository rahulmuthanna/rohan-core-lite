import { describe, expect, it } from 'vitest';
import { api, createBooking, expectError, unitId } from './helpers/test-helpers.js';

describe('Inventory', () => {
  it('lists all 12 seeded units, all Available', async () => {
    const response = await api.get('/api/units?page_size=100');
    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 1, page_size: 100, total: 12 });
    expect(response.body.data).toHaveLength(12);
    expect(response.body.data.every((unit: { status: string }) => unit.status === 'AVAILABLE')).toBe(true);
  });

  it('returns the seeded details of RN-101', async () => {
    const response = await api.get(`/api/units/${await unitId('RN-101')}`);
    expect(response.body.data).toMatchObject({
      unit_code: 'RN-101',
      unit_type: '2 BHK',
      area_sqft: 1100,
      listed_price_paise: 680000000,
      status: 'AVAILABLE',
      project_name: 'Rohan Nest',
    });
  });

  it('lists the four projects for the filter', async () => {
    const response = await api.get('/api/projects');
    expect(response.body.data.map((project: { name: string }) => project.name)).toEqual([
      'Rohan City',
      'Rohan Estate',
      'Rohan Nest',
      'Rohan Park',
    ]);
  });

  it('filters by project, unit type and status together', async () => {
    await createBooking({ unitCode: 'RN-201' });
    const projects = await api.get('/api/projects');
    const nest = projects.body.data.find((project: { name: string }) => project.name === 'Rohan Nest');

    const response = await api.get('/api/units').query({ project_id: nest.id, unit_type: '3 BHK', status: 'AVAILABLE' });
    expect(response.body.data.map((unit: { unit_code: string }) => unit.unit_code)).toEqual(['RN-301']);

    const booked = await api.get('/api/units').query({ status: 'BOOKED' });
    expect(booked.body.data.map((unit: { unit_code: string }) => unit.unit_code)).toEqual(['RN-201']);
  });

  it('treats an empty filter value as "no filter"', async () => {
    const response = await api.get('/api/units?project_id=&unit_type=&status=');
    expect(response.body.pagination.total).toBe(12);
  });

  it('pages through the list', async () => {
    const response = await api.get('/api/units?page=2&page_size=5');
    expect(response.body.data).toHaveLength(5);
    expect(response.body.pagination).toEqual({ page: 2, page_size: 5, total: 12 });
  });

  it('rejects an unknown filter value', async () => {
    expectError(await api.get('/api/units?status=HOLD'), 400, 'VALIDATION_ERROR');
    expectError(await api.get('/api/units?unit_type=4%20BHK'), 400, 'VALIDATION_ERROR');
    expectError(await api.get('/api/units?page=0'), 400, 'VALIDATION_ERROR');
  });
});

describe('Changing a unit price', () => {
  it('changes the price of an Available unit', async () => {
    const id = await unitId('RN-101');
    const response = await api.patch(`/api/units/${id}/price`).send({ listed_price_paise: 700000000 });
    expect(response.status).toBe(200);
    expect(response.body.data.listed_price_paise).toBe(700000000);
  });

  it('rejects a zero, negative, fractional or missing price', async () => {
    const id = await unitId('RN-101');
    for (const price of [0, -100, 100.5, '700000000', undefined]) {
      expectError(await api.patch(`/api/units/${id}/price`).send({ listed_price_paise: price }), 400, 'VALIDATION_ERROR');
    }
  });

  it('rejects a price change once the unit is booked', async () => {
    await createBooking({ unitCode: 'RN-101' });
    const response = await api.patch(`/api/units/${await unitId('RN-101')}/price`).send({ listed_price_paise: 700000000 });
    expectError(response, 409, 'UNIT_NOT_AVAILABLE');
  });

  it('answers 404 for a unit that does not exist', async () => {
    expectError(await api.patch('/api/units/999999/price').send({ listed_price_paise: 700000000 }), 404, 'UNIT_NOT_FOUND');
  });
});
