import request, { type Response } from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { runSeed } from '../../src/db/admin.js';
import { pool } from '../../src/db/pool.js';
import { todayInIndia } from '../../src/shared/dates.js';

/** Sends real HTTP requests to the application, exactly as a browser would. */
export const api = request(createApp());

export const today = todayInIndia;

/** Empties every table, restarts all numbering, and loads the 12 seeded units again. */
export async function resetData(): Promise<void> {
  await pool.query(
    `TRUNCATE payments, payment_milestones, bookings, quotations, cost_sheets, customers, units, projects
     RESTART IDENTITY CASCADE`,
  );
  await pool.query(
    'ALTER SEQUENCE cost_sheet_number_seq RESTART; ALTER SEQUENCE quotation_number_seq RESTART; ALTER SEQUENCE booking_number_seq RESTART;',
  );
  await runSeed(pool);
}

/** Checks that a response is an error with the expected HTTP status and error code. */
export function expectError(response: Response, status: number, code: string): void {
  expect(response.body.error?.code, JSON.stringify(response.body)).toBe(code);
  expect(response.status).toBe(status);
}

export async function unitId(unitCode: string): Promise<number> {
  const result = await pool.query<{ id: number }>('SELECT id FROM units WHERE unit_code = $1', [unitCode]);
  const id = result.rows[0]?.id;
  if (id === undefined) {
    throw new Error(`Unit ${unitCode} is not in the seed data.`);
  }
  return id;
}

export async function unitStatus(unitCode: string): Promise<string> {
  const result = await pool.query<{ status: string }>('SELECT status FROM units WHERE unit_code = $1', [unitCode]);
  return result.rows[0]?.status ?? 'MISSING';
}

export async function countRows(table: 'bookings' | 'payment_milestones' | 'payments' | 'cost_sheets'): Promise<number> {
  const result = await pool.query<{ total: number }>(`SELECT count(*) AS total FROM ${table}`);
  return result.rows[0]?.total ?? 0;
}

let customerCounter = 0;

/** Creates a customer through the API. Each call uses a new mobile number unless one is given. */
export async function createCustomer(
  overrides: Partial<{ full_name: string; mobile: string; email: string }> = {},
): Promise<{ id: number; full_name: string; mobile: string; email: string }> {
  customerCounter += 1;
  const response = await api.post('/api/customers').send({
    full_name: 'Asha Verma',
    mobile: String(9000000000 + customerCounter),
    email: `customer${customerCounter}@example.com`,
    ...overrides,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.data;
}

/** Saves a cost sheet through the API. Defaults to the assignment example: RN-101 at 1% (100 basis points). */
export async function createCostSheet(
  options: { unitCode?: string; discountBps?: number; customerId?: number } = {},
) {
  const customerId = options.customerId ?? (await createCustomer()).id;
  const response = await api.post('/api/cost-sheets').send({
    unit_id: await unitId(options.unitCode ?? 'RN-101'),
    customer_id: customerId,
    discount_bps: options.discountBps ?? 100,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.data;
}

/** Creates a Draft quotation from a new cost sheet. */
export async function createDraftQuotation(
  options: { unitCode?: string; discountBps?: number; customerId?: number } = {},
) {
  const costSheet = await createCostSheet(options);
  const response = await api.post('/api/quotations').send({ cost_sheet_id: costSheet.id });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.data;
}

/** Creates a quotation and moves it Draft -> Sent -> Accepted. */
export async function createAcceptedQuotation(
  options: { unitCode?: string; discountBps?: number; customerId?: number } = {},
) {
  const quotation = await createDraftQuotation(options);
  const sent = await api.post(`/api/quotations/${quotation.id}/send`);
  expect(sent.status, JSON.stringify(sent.body)).toBe(200);
  const accepted = await api.post(`/api/quotations/${quotation.id}/accept`);
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
  return accepted.body.data;
}

/** Creates a booking from a new accepted quotation. */
export async function createBooking(options: { unitCode?: string; discountBps?: number; customerId?: number } = {}) {
  const quotation = await createAcceptedQuotation(options);
  const response = await api.post('/api/bookings').send({ quotation_id: quotation.id });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.data;
}

let referenceCounter = 0;

/** Records a payment through the API and returns the raw response. */
export function pay(bookingId: number, amountPaise: number, reference?: string) {
  referenceCounter += 1;
  return api.post(`/api/bookings/${bookingId}/payments`).send({
    amount_paise: amountPaise,
    payment_date: today(),
    payment_reference: reference ?? `TEST-REF-${referenceCounter}`,
  });
}

/**
 * Makes a quotation look as if it was issued `daysAgo` days ago, straight in the database.
 * This is how the tests check expiry without waiting a week.
 */
export async function backdateQuotation(quotationId: number, daysAgo: number): Promise<void> {
  await pool.query(
    `UPDATE quotations
     SET issue_date  = (now() AT TIME ZONE 'Asia/Kolkata')::date - $2::int,
         valid_until = (now() AT TIME ZONE 'Asia/Kolkata')::date - $2::int + 7
     WHERE id = $1`,
    [quotationId, daysAgo],
  );
}
