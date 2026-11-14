/** One field-level problem reported by the server, e.g. { field: 'mobile', message: '...' }. */
export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Every failed request becomes an ApiError.
 * `code` is the server's fixed error code (for example 'DUPLICATE_MOBILE'),
 * `message` is the sentence to show the user, and `details` points at input fields.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];

  constructor(status: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** The server's message for one input field, if it reported one. */
  fieldMessage(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message;
  }
}

/** Turns anything that was thrown into an ApiError, so screens only handle one kind of error. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError(0, 'UNEXPECTED_ERROR', 'Something went wrong. Please try again.');
}

type QueryValue = string | number | undefined | null;

/** Builds '?a=1&b=2', leaving out anything empty. */
export function queryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text === '' ? '' : `?${text}`;
}

/**
 * The single place that talks to the server.
 * Returns the parsed JSON body on success and throws an ApiError otherwise.
 */
export async function request<Body>(method: string, path: string, body?: unknown): Promise<Body> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check that the API is running, then try again.');
  }

  if (response.status === 204) {
    return undefined as Body;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(response.status, 'BAD_RESPONSE', 'The server sent a reply that could not be read.');
  }

  if (!response.ok) {
    const error = (json as { error?: { code?: string; message?: string; details?: ErrorDetail[] } }).error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNEXPECTED_ERROR',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.details ?? [],
    );
  }
  return json as Body;
}
