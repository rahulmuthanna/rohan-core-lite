import type { NextFunction, Request, Response } from 'express';
import { AppError, conflict, ErrorCode } from './errors.js';

/**
 * The database is the last line of defence. If two requests race past the
 * checks in the code, a database constraint still rejects the second one.
 * This table turns each such constraint into the same friendly error the code would give.
 */
const CONSTRAINT_ERRORS: Record<string, () => AppError> = {
  customers_mobile_key: () =>
    conflict(ErrorCode.DUPLICATE_MOBILE, 'A customer with this mobile number already exists.', [
      { field: 'mobile', message: 'This mobile number is already in use.' },
    ]),
  payments_payment_reference_key: () =>
    conflict(ErrorCode.DUPLICATE_PAYMENT_REFERENCE, 'This payment reference has already been recorded.', [
      { field: 'payment_reference', message: 'This reference has already been used.' },
    ]),
  bookings_unit_id_key: () => conflict(ErrorCode.UNIT_NOT_AVAILABLE, 'This unit has already been booked.'),
  bookings_quotation_id_key: () =>
    conflict(ErrorCode.QUOTATION_ALREADY_BOOKED, 'This quotation has already been used for a booking.'),
  quotations_cost_sheet_id_fkey: () =>
    conflict(
      ErrorCode.COST_SHEET_HAS_QUOTATIONS,
      'This cost sheet cannot be deleted because a quotation has been created from it.',
    ),
};

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const raw = error as { type?: string; constraint?: string };
  if (raw?.type === 'entity.parse.failed') {
    return new AppError(400, ErrorCode.INVALID_JSON, 'The request body is not valid JSON.');
  }
  const fromConstraint = raw?.constraint ? CONSTRAINT_ERRORS[raw.constraint] : undefined;
  if (fromConstraint) {
    return fromConstraint();
  }
  return new AppError(500, ErrorCode.INTERNAL_ERROR, 'Something went wrong on the server. Please try again.');
}

/** Answers any request whose path matches no route. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: ErrorCode.ROUTE_NOT_FOUND,
      message: `No API endpoint matches ${req.method} ${req.path}.`,
      details: [],
    },
  });
}

/**
 * The single place where errors become HTTP responses.
 * Every error response has the same shape: { error: { code, message, details } }.
 */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const appError = toAppError(error);
  if (appError.status >= 500) {
    console.error(error);
  }
  res.status(appError.status).json({
    error: { code: appError.code, message: appError.message, details: appError.details },
  });
}
