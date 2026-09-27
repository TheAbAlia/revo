import assert from 'node:assert/strict';
import test from 'node:test';

import {
  googleHttpError,
  googleOAuthError
} from '@/lib/integrations/google/errors';
import { PermanentJobError } from '@/lib/jobs/errors';

test('Google 429 errors are retryable', () => {
  const error = googleHttpError(
    'Google reviews request',
    429
  );

  assert.ok(error instanceof Error);
  assert.equal(error instanceof PermanentJobError, false);
});

test('Google 503 errors are retryable', () => {
  const error = googleHttpError(
    'Google reviews request',
    503
  );

  assert.ok(error instanceof Error);
  assert.equal(error instanceof PermanentJobError, false);
});

test('Google 400 errors are permanent', () => {
  const error = googleHttpError(
    'Google reviews request',
    400
  );

  assert.ok(error instanceof PermanentJobError);
});

test('Google OAuth invalid_grant is permanent', () => {
  const error = googleOAuthError(
    'Google access token refresh',
    'invalid_grant',
    'Token has been expired or revoked.'
  );

  assert.ok(error instanceof PermanentJobError);
  assert.equal(
    error.message,
    'Token has been expired or revoked.'
  );
});

test('unknown Google OAuth errors remain retryable', () => {
  const error = googleOAuthError(
    'Google access token refresh',
    'temporarily_unavailable',
    'Temporary OAuth failure'
  );

  assert.ok(error instanceof Error);
  assert.equal(error instanceof PermanentJobError, false);
  assert.equal(error.message, 'Temporary OAuth failure');
});
