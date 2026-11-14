/**
 * Every error the API can return, in one list.
 * The frontend and the tests rely on these codes, so treat them as part of the API.
 */
export const ErrorCode = {
  // 400: the request itself is wrong.
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',

  // 404: the thing asked for does not exist.
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  UNIT_NOT_FOUND: 'UNIT_NOT_FOUND',
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  COST_SHEET_NOT_FOUND: 'COST_SHEET_NOT_FOUND',
  QUOTATION_NOT_FOUND: 'QUOTATION_NOT_FOUND',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',

  // 409: the request is fine, but it clashes with the current data.
  DUPLICATE_MOBILE: 'DUPLICATE_MOBILE',
  UNIT_NOT_AVAILABLE: 'UNIT_NOT_AVAILABLE',
  COST_SHEET_HAS_QUOTATIONS: 'COST_SHEET_HAS_QUOTATIONS',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  QUOTATION_EXPIRED: 'QUOTATION_EXPIRED',
  QUOTATION_NOT_ACCEPTED: 'QUOTATION_NOT_ACCEPTED',
  QUOTATION_ALREADY_BOOKED: 'QUOTATION_ALREADY_BOOKED',
  OVERPAYMENT: 'OVERPAYMENT',
  DUPLICATE_PAYMENT_REFERENCE: 'DUPLICATE_PAYMENT_REFERENCE',
  BOOKING_FULLY_PAID: 'BOOKING_FULLY_PAID',

  // 500: a bug or an outage on the server.
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Points at the input field that caused an error, so the screen can highlight it. */
export interface ErrorDetail {
  field: string;
  message: string;
}

/** An error we raise on purpose. The error handler turns it into the JSON error response. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ErrorDetail[];

  constructor(status: number, code: ErrorCode, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details: ErrorDetail[] = []): AppError {
  return new AppError(400, ErrorCode.VALIDATION_ERROR, message, details);
}

export function notFound(code: ErrorCode, message: string): AppError {
  return new AppError(404, code, message);
}

export function conflict(code: ErrorCode, message: string, details: ErrorDetail[] = []): AppError {
  return new AppError(409, code, message, details);
}
