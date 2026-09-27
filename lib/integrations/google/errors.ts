import { PermanentJobError } from '@/lib/jobs/errors';

const RETRYABLE_GOOGLE_HTTP_STATUSES =
  new Set([429, 500, 502, 503, 504]);

export function googleHttpError(
  operation: string,
  status: number
): Error {
  const message =
    `${operation} failed with status ${status}`;

  if (RETRYABLE_GOOGLE_HTTP_STATUSES.has(status)) {
    return new Error(message);
  }

  return new PermanentJobError(message);
}

export function googleOAuthError(
  operation: string,
  errorCode: string | undefined,
  description: string | undefined
): Error {
  const message =
    description ||
    errorCode ||
    `${operation} failed`;

  if (errorCode === 'invalid_grant') {
    return new PermanentJobError(message);
  }

  return new Error(message);
}
