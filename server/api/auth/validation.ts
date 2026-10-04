export const AUTH_CREDENTIAL_LIMITS = {
  emailMaxLength: 255,
  passwordMinLength: 8,
  passwordMaxLength: 100
} as const;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const email = normalizeEmail(value);

  if (
    email.length === 0 ||
    email.length > AUTH_CREDENTIAL_LIMITS.emailMaxLength ||
    !EMAIL_PATTERN.test(email)
  ) {
    return null;
  }

  return email;
}

export function validatePassword(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  if (
    value.length < AUTH_CREDENTIAL_LIMITS.passwordMinLength ||
    value.length > AUTH_CREDENTIAL_LIMITS.passwordMaxLength
  ) {
    return null;
  }

  return value;
}
