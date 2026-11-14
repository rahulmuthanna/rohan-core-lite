import { z } from 'zod';
import { optionalQuery, paginationFields } from '../../shared/validation.js';

const fullName = z
  .string({ error: 'Name is required.' })
  .trim()
  .min(2, 'Name must be at least 2 characters.')
  .max(100, 'Name must be at most 100 characters.');

const mobile = z
  .string({ error: 'Mobile number is required.' })
  .trim()
  .regex(/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits.');

const email = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .max(254, 'Email must be at most 254 characters.')
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address.');

export const createCustomerSchema = z.object({ full_name: fullName, mobile, email });
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z
  .object({ full_name: fullName.optional(), mobile: mobile.optional(), email: email.optional() })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to change: full_name, mobile or email.',
  });
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const listCustomersQuerySchema = z.object({
  search: optionalQuery(z.string().trim().max(100, 'search must be at most 100 characters.')),
  ...paginationFields,
});
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
