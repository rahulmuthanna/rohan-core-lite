import { pool } from '../../db/pool.js';
import { conflict, ErrorCode, notFound } from '../../shared/errors.js';
import type { Pagination } from '../../shared/validation.js';
import * as customersRepo from './customers.repo.js';
import type { Customer } from './customers.repo.js';
import type { CreateCustomerInput, ListCustomersQuery, UpdateCustomerInput } from './customers.schemas.js';

export function customerNotFound(): Error {
  return notFound(ErrorCode.CUSTOMER_NOT_FOUND, 'Customer not found.');
}

function duplicateMobile(): Error {
  return conflict(ErrorCode.DUPLICATE_MOBILE, 'A customer with this mobile number already exists.', [
    { field: 'mobile', message: 'This mobile number is already in use.' },
  ]);
}

export async function listCustomers(query: ListCustomersQuery): Promise<{ data: Customer[]; pagination: Pagination }> {
  const { rows, total } = await customersRepo.listCustomers(pool, query.search, query.page, query.page_size);
  return { data: rows, pagination: { page: query.page, page_size: query.page_size, total } };
}

export async function getCustomer(id: number): Promise<Customer> {
  const customer = await customersRepo.findCustomerById(pool, id);
  if (!customer) {
    throw customerNotFound();
  }
  return customer;
}

/**
 * Rule C2: a mobile number can belong to only one customer.
 * The check here gives a friendly error; the UNIQUE constraint in the database
 * (customers_mobile_key) still protects us if two requests arrive at the same moment.
 */
export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  if (await customersRepo.findCustomerByMobile(pool, input.mobile)) {
    throw duplicateMobile();
  }
  return customersRepo.insertCustomer(pool, input);
}

export async function updateCustomer(id: number, input: UpdateCustomerInput): Promise<Customer> {
  if (input.mobile !== undefined) {
    const owner = await customersRepo.findCustomerByMobile(pool, input.mobile);
    if (owner && owner.id !== id) {
      throw duplicateMobile();
    }
  }
  const customer = await customersRepo.updateCustomer(pool, id, input);
  if (!customer) {
    throw customerNotFound();
  }
  return customer;
}
