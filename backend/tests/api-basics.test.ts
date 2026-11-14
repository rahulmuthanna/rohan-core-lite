import { describe, expect, it } from 'vitest';
import { api, expectError } from './helpers/test-helpers.js';

describe('API basics', () => {
  it('reports healthy when the server and database are reachable', async () => {
    const response = await api.get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });

  it('answers an unknown path with 404 ROUTE_NOT_FOUND', async () => {
    expectError(await api.get('/api/does-not-exist'), 404, 'ROUTE_NOT_FOUND');
  });

  it('answers a broken JSON body with 400 INVALID_JSON', async () => {
    const response = await api.post('/api/customers').set('Content-Type', 'application/json').send('{not json');
    expectError(response, 400, 'INVALID_JSON');
  });

  it('answers a non-numeric id with 400 VALIDATION_ERROR', async () => {
    expectError(await api.get('/api/units/abc'), 400, 'VALIDATION_ERROR');
  });

  it('uses the same error shape everywhere: code, message and details', async () => {
    const response = await api.get('/api/units/999999');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found.', details: [] },
    });
  });
});
