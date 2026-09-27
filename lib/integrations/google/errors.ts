import { PermanentJobError } from '@/lib/jobs/errors';

const RETRYABLE_GOOGLE_HTTP_STATUSES =
  new Set([429, 500, 502, 503, 504]);

export class GoogleOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string | undefined
  ) {
    super(message);
    this.name = 'GoogleOAuthError';
  }
}

export class PermanentGoogleOAuthError
  extends PermanentJobError {
  constructor(
    message: string,
    public readonly code: string | undefined
  ) {
    super(message);
    this.name = 'PermanentGoogleOAuthError';
  }
}

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
    return new PermanentGoogleOAuthError(
      message,
      errorCode
    );
  }

  return new GoogleOAuthError(
    message,
    errorCode
  );
}

export function isGoogleOAuthReauthError(
  error: unknown
): error is PermanentGoogleOAuthError {
  return (
    error instanceof PermanentGoogleOAuthError &&
    error.code === 'invalid_grant'
  );
}
