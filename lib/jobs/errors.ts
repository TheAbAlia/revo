export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

export function isPermanentJobError(
  error: unknown
): error is PermanentJobError {
  return error instanceof PermanentJobError;
}
