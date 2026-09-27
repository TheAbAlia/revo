import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchGoogleBusinessAccounts
} from '@/lib/integrations/google/accounts';
import {
  PermanentJobError
} from '@/lib/jobs/errors';

test('fetchGoogleBusinessAccounts normalizes Google account IDs', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
    );

    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      'Bearer access-token'
    );

    return new Response(
      JSON.stringify({
        accounts: [
          {
            name: 'accounts/account-123',
            accountName: 'Darmstadt Business'
          },
          {
            name: 'account-456',
            accountName: 'Frankfurt Business'
          },
          {
            accountName: 'Missing resource name'
          }
        ]
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  };

  try {
    const accounts =
      await fetchGoogleBusinessAccounts(
        'access-token'
      );

    assert.deepEqual(accounts, [
      {
        externalAccountId: 'account-123',
        name: 'Darmstadt Business'
      },
      {
        externalAccountId: 'account-456',
        name: 'Frankfurt Business'
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Google account rate-limit errors remain retryable', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(null, { status: 429 });

  try {
    await assert.rejects(
      () =>
        fetchGoogleBusinessAccounts(
          'access-token'
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(
          error instanceof PermanentJobError,
          false
        );
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('permanent Google account errors are classified permanently', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(null, { status: 400 });

  try {
    await assert.rejects(
      () =>
        fetchGoogleBusinessAccounts(
          'access-token'
        ),
      (error: unknown) => {
        assert.ok(
          error instanceof PermanentJobError
        );
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
