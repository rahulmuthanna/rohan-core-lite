import { queryString, request } from './client';
import type {
  Booking,
  BookingDetail,
  CostSheet,
  CostSheetPreview,
  Customer,
  CustomerInput,
  Dashboard,
  Page,
  Payment,
  PaymentInput,
  Project,
  Quotation,
  QuotationStatus,
  Unit,
  UnitStatus,
  UnitType,
} from './types';

/**
 * One function per API endpoint. Screens call these and never build URLs themselves.
 * Single items come back unwrapped; lists come back as { data, pagination }.
 */

interface One<Item> {
  data: Item;
}

async function one<Item>(method: string, path: string, body?: unknown): Promise<Item> {
  return (await request<One<Item>>(method, path, body)).data;
}

// ---------- Dashboard ----------

export function getDashboard(): Promise<Dashboard> {
  return one('GET', '/dashboard');
}

// ---------- Projects and units ----------

export function listProjects(): Promise<Project[]> {
  return one('GET', '/projects');
}

export function listUnits(params: {
  project_id?: number | undefined;
  unit_type?: UnitType | undefined;
  status?: UnitStatus | undefined;
  page?: number;
  page_size?: number;
}): Promise<Page<Unit>> {
  return request('GET', `/units${queryString(params)}`);
}

export function getUnit(id: number): Promise<Unit> {
  return one('GET', `/units/${id}`);
}

export function changeUnitPrice(id: number, listedPricePaise: number): Promise<Unit> {
  return one('PATCH', `/units/${id}/price`, { listed_price_paise: listedPricePaise });
}

// ---------- Customers ----------

export function listCustomers(params: { search?: string; page?: number; page_size?: number }): Promise<Page<Customer>> {
  return request('GET', `/customers${queryString(params)}`);
}

export function getCustomer(id: number): Promise<Customer> {
  return one('GET', `/customers/${id}`);
}

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return one('POST', '/customers', input);
}

export function updateCustomer(id: number, input: CustomerInput): Promise<Customer> {
  return one('PATCH', `/customers/${id}`, input);
}

// ---------- Cost sheets ----------

export function previewCostSheet(unitId: number, discountBps: number): Promise<CostSheetPreview> {
  return one('POST', '/cost-sheets/preview', { unit_id: unitId, discount_bps: discountBps });
}

export function createCostSheet(input: { unit_id: number; customer_id: number; discount_bps: number }): Promise<CostSheet> {
  return one('POST', '/cost-sheets', input);
}

export function listCostSheets(params: { page?: number; page_size?: number }): Promise<Page<CostSheet>> {
  return request('GET', `/cost-sheets${queryString(params)}`);
}

export function getCostSheet(id: number): Promise<CostSheet> {
  return one('GET', `/cost-sheets/${id}`);
}

export function deleteCostSheet(id: number): Promise<void> {
  return request('DELETE', `/cost-sheets/${id}`);
}

// ---------- Quotations ----------

export function listQuotations(params: {
  status?: QuotationStatus | undefined;
  cost_sheet_id?: number;
  page?: number;
  page_size?: number;
}): Promise<Page<Quotation>> {
  return request('GET', `/quotations${queryString(params)}`);
}

export function getQuotation(id: number): Promise<Quotation> {
  return one('GET', `/quotations/${id}`);
}

export function createQuotation(costSheetId: number): Promise<Quotation> {
  return one('POST', '/quotations', { cost_sheet_id: costSheetId });
}

export function sendQuotation(id: number): Promise<Quotation> {
  return one('POST', `/quotations/${id}/send`);
}

export function acceptQuotation(id: number): Promise<Quotation> {
  return one('POST', `/quotations/${id}/accept`);
}

// ---------- Bookings and payments ----------

export function listBookings(params: { page?: number; page_size?: number }): Promise<Page<Booking>> {
  return request('GET', `/bookings${queryString(params)}`);
}

export function getBooking(id: number): Promise<BookingDetail> {
  return one('GET', `/bookings/${id}`);
}

export function createBooking(quotationId: number): Promise<BookingDetail> {
  return one('POST', '/bookings', { quotation_id: quotationId });
}

export function recordPayment(
  bookingId: number,
  input: PaymentInput,
): Promise<{ payment: Payment; booking: BookingDetail }> {
  return one('POST', `/bookings/${bookingId}/payments`, input);
}
