import { z } from 'zod';
import { badRequest } from './errors.js';

/**
 * Checks `input` against a schema. Returns the cleaned value,
 * or throws a 400 VALIDATION_ERROR listing every field that is wrong.
 */
export function validate<Output>(schema: z.ZodType<Output>, input: unknown): Output {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'request',
    message: issue.message,
  }));
  throw badRequest('Some of the information provided is not valid.', details);
}

/** A database id sent in the request body: a positive whole number. */
export function idField(label: string) {
  return z
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .positive(`${label} must be a positive number.`);
}

/** A database id arriving as text (in the URL path or the query string). */
export function idFromText(label: string) {
  return z.coerce
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .positive(`${label} must be a positive number.`);
}

/** Query string values arrive as text, and an empty value means "not provided". */
export function optionalQuery<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

/** The `:id` part of a URL such as /api/units/7. */
export const idParamSchema = z.object({ id: idFromText('id') });

/** Paging fields shared by every list endpoint. */
export const paginationFields = {
  page: optionalQuery(
    z.coerce.number({ error: 'page must be a number.' }).int('page must be a whole number.').min(1, 'page must be 1 or more.'),
  ).transform((value) => value ?? 1),
  page_size: optionalQuery(
    z.coerce
      .number({ error: 'page_size must be a number.' })
      .int('page_size must be a whole number.')
      .min(1, 'page_size must be between 1 and 100.')
      .max(100, 'page_size must be between 1 and 100.'),
  ).transform((value) => value ?? 20),
};

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
}
