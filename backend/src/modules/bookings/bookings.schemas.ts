import { z } from 'zod';
import { idField, idFromText, optionalQuery, paginationFields } from '../../shared/validation.js';

export const createBookingSchema = z.object({
  quotation_id: idField('quotation_id'),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const listBookingsQuerySchema = z.object({
  customer_id: optionalQuery(idFromText('customer_id')),
  ...paginationFields,
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
