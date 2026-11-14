import { z } from 'zod';
import { MAX_PRICE_PAISE, MIN_PRICE_PAISE, UNIT_STATUSES, UNIT_TYPES } from '../../shared/business-rules.js';
import { idFromText, optionalQuery, paginationFields } from '../../shared/validation.js';

export const listUnitsQuerySchema = z.object({
  project_id: optionalQuery(idFromText('project_id')),
  unit_type: optionalQuery(z.enum(UNIT_TYPES, { error: 'unit_type must be one of: 1 BHK, 2 BHK, 3 BHK.' })),
  status: optionalQuery(z.enum(UNIT_STATUSES, { error: 'status must be one of: AVAILABLE, BOOKED, SOLD.' })),
  ...paginationFields,
});
export type ListUnitsQuery = z.infer<typeof listUnitsQuerySchema>;

export const changeUnitPriceSchema = z.object({
  listed_price_paise: z
    .number({ error: 'listed_price_paise must be a number.' })
    .int('listed_price_paise must be a whole number of paise.')
    .min(MIN_PRICE_PAISE, 'The price must be at least ₹1.')
    .max(MAX_PRICE_PAISE, 'The price is too large.'),
});
export type ChangeUnitPriceInput = z.infer<typeof changeUnitPriceSchema>;
