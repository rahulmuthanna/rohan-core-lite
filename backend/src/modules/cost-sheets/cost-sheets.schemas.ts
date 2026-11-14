import { z } from 'zod';
import { MAX_DISCOUNT_BPS, MIN_DISCOUNT_BPS } from '../../shared/business-rules.js';
import { idField, idFromText, optionalQuery, paginationFields } from '../../shared/validation.js';

/** Discount in basis points: 100 = 1%. Allowed range 0 to 200 (0% to 2%). */
const discountBps = z
  .number({ error: 'discount_bps must be a number.' })
  .int('discount_bps must be a whole number of basis points (two decimal places of a percent).')
  .min(MIN_DISCOUNT_BPS, 'Discount must be between 0% and 2%.')
  .max(MAX_DISCOUNT_BPS, 'Discount must be between 0% and 2%.');

export const previewCostSheetSchema = z.object({
  unit_id: idField('unit_id'),
  discount_bps: discountBps,
});
export type PreviewCostSheetInput = z.infer<typeof previewCostSheetSchema>;

export const createCostSheetSchema = z.object({
  unit_id: idField('unit_id'),
  customer_id: idField('customer_id'),
  discount_bps: discountBps,
});
export type CreateCostSheetInput = z.infer<typeof createCostSheetSchema>;

export const listCostSheetsQuerySchema = z.object({
  customer_id: optionalQuery(idFromText('customer_id')),
  unit_id: optionalQuery(idFromText('unit_id')),
  ...paginationFields,
});
export type ListCostSheetsQuery = z.infer<typeof listCostSheetsQuerySchema>;
