import { describe, expect, it } from 'vitest';
import { api, createCustomer, expectError } from './helpers/test-helpers.js';

describe('Adding a customer', () => {
  it('saves a customer, trimming spaces and lowercasing the email', async () => {
    const response = await api
      .post('/api/customers')
      .send({ full_name: '  Asha Verma  ', mobile: ' 9876543210 ', email: '  Asha@Example.COM ' });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      full_name: 'Asha Verma',
      mobile: '9876543210',
      email: 'asha@example.com',
    });
  });

  it('rejects invalid data and names every field that is wrong', async () => {
    const response = await api.post('/api/customers').send({ full_name: 'A', mobile: '98765', email: 'not-an-email' });
    expectError(response, 400, 'VALIDATION_ERROR');
    expect(response.body.error.details.map((detail: { field: string }) => detail.field).sort()).toEqual([
      'email',
      'full_name',
      'mobile',
    ]);
  });

  it('rejects a mobile that is not exactly 10 digits', async () => {
    for (const mobile of ['987654321', '98765432100', '98765abcde', '+919876543210', '']) {
      const response = await api.post('/api/customers').send({ full_name: 'Asha Verma', mobile, email: 'a@example.com' });
      expectError(response, 400, 'VALIDATION_ERROR');
    }
  });

  it('rejects missing fields', async () => {
    expectError(await api.post('/api/customers').send({}), 400, 'VALIDATION_ERROR');
  });

  it('prevents a duplicate mobile number', async () => {
    await createCustomer({ mobile: '9876543210' });
    const response = await api
      .post('/api/customers')
      .send({ full_name: 'Someone Else', mobile: '9876543210', email: 'else@example.com' });
    expectError(response, 409, 'DUPLICATE_MOBILE');
    expect(response.body.error.details).toEqual([{ field: 'mobile', message: 'This mobile number is already in use.' }]);
  });

  it('prevents a duplicate mobile even when two requests arrive at the same moment', async () => {
    const body = { full_name: 'Asha Verma', mobile: '9876543210', email: 'asha@example.com' };
    const responses = await Promise.all([api.post('/api/customers').send(body), api.post('/api/customers').send(body)]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  });
});

describe('Editing a customer', () => {
  it('changes only the fields that are sent', async () => {
    const customer = await createCustomer({ full_name: 'Asha Verma', mobile: '9876543210' });
    const response = await api.patch(`/api/customers/${customer.id}`).send({ full_name: 'Asha V. Rao' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ full_name: 'Asha V. Rao', mobile: '9876543210', email: customer.email });
  });

  it('allows saving a customer with their own unchanged mobile', async () => {
    const customer = await createCustomer({ mobile: '9876543210' });
    const response = await api.patch(`/api/customers/${customer.id}`).send({ mobile: '9876543210', full_name: 'New Name' });
    expect(response.status).toBe(200);
  });

  it("prevents changing to another customer's mobile", async () => {
    await createCustomer({ mobile: '9876543210' });
    const other = await createCustomer({ mobile: '9123456780' });
    expectError(await api.patch(`/api/customers/${other.id}`).send({ mobile: '9876543210' }), 409, 'DUPLICATE_MOBILE');
  });

  it('rejects invalid values and an empty change', async () => {
    const customer = await createCustomer();
    expectError(await api.patch(`/api/customers/${customer.id}`).send({ mobile: '123' }), 400, 'VALIDATION_ERROR');
    expectError(await api.patch(`/api/customers/${customer.id}`).send({}), 400, 'VALIDATION_ERROR');
  });

  it('answers 404 for a customer that does not exist', async () => {
    expectError(await api.patch('/api/customers/999999').send({ full_name: 'Nobody Here' }), 404, 'CUSTOMER_NOT_FOUND');
    expectError(await api.get('/api/customers/999999'), 404, 'CUSTOMER_NOT_FOUND');
  });
});

describe('Listing and searching customers', () => {
  it('searches by part of the name, mobile or email, ignoring capitals', async () => {
    await createCustomer({ full_name: 'Asha Verma', mobile: '9876543210', email: 'asha@example.com' });
    await createCustomer({ full_name: 'Vikram Rao', mobile: '9123456780', email: 'vikram@rohan.test' });

    const names = async (search: string) =>
      (await api.get('/api/customers').query({ search })).body.data.map((c: { full_name: string }) => c.full_name);

    expect(await names('ASHA')).toEqual(['Asha Verma']);
    expect(await names('91234')).toEqual(['Vikram Rao']);
    expect(await names('rohan.test')).toEqual(['Vikram Rao']);
    expect(await names('a')).toEqual(['Asha Verma', 'Vikram Rao']);
    expect(await names('zzz')).toEqual([]);
  });

  it('treats % and _ in a search as ordinary characters', async () => {
    await createCustomer({ full_name: 'Asha Verma' });
    const response = await api.get('/api/customers').query({ search: '%' });
    expect(response.body.data).toEqual([]);
  });

  it('lists everyone with a total when there is no search', async () => {
    await createCustomer();
    await createCustomer();
    const response = await api.get('/api/customers');
    expect(response.body.pagination.total).toBe(2);
  });
});
