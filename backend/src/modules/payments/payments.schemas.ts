import { z } from 'zod';
import { isRealDate, todayInIndia } from '../../shared/dates.js';

export const recordPaymentSchema = z.object({
  amount_paise: z
    .number({ error: 'Amount is required.' })
    .int('Amount must be a whole number of paise (at most two decimal places of a rupee).')
    .positive('Amount must be more than zero.'),
  payment_date: z
    .string({ error: 'Payment date is required.' })
    .refine(isRealDate, 'Payment date must be a real date in the form YYYY-MM-DD.')
    .refine((date) => date <= todayInIndia(), 'Payment date cannot be in the future.'),
  payment_reference: z
    .string({ error: 'Payment reference is required.' })
    .trim()
    .min(1, 'Payment reference is required.')
    .max(50, 'Payment reference must be at most 50 characters.')
    // Stored in capitals so that "utr123" and "UTR123" count as the same reference.
    .toUpperCase(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
