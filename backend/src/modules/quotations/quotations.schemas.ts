import { z } from 'zod';
import { QUOTATION_STATUSES } from '../../shared/business-rules.js';
import { idField, idFromText, optionalQuery, paginationFields } from '../../shared/validation.js';

export const createQuotationSchema = z.object({
  cost_sheet_id: idField('cost_sheet_id'),
});
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

export const listQuotationsQuerySchema = z.object({
  status: optionalQuery(
    z.enum(QUOTATION_STATUSES, { error: 'status must be one of: DRAFT, SENT, ACCEPTED, EXPIRED.' }),
  ),
  customer_id: optionalQuery(idFromText('customer_id')),
  unit_id: optionalQuery(idFromText('unit_id')),
  cost_sheet_id: optionalQuery(idFromText('cost_sheet_id')),
  ...paginationFields,
});
export type ListQuotationsQuery = z.infer<typeof listQuotationsQuerySchema>;
