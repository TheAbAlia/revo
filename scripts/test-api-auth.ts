import assert from 'node:assert/strict';
import test from 'node:test';

import { signToken } from '@/lib/auth/token';
import { buildApi } from '@/server/api/app';

test('GET /v1/me rejects requests without a session', async () => {
  const api = buildApi();

  try {
    const response = await api.inject({
      method: 'GET',
      url: '/v1/me'
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      error: 'Unauthorized'
    });
  } finally {
    await api.close();
  }
});

test('GET /v1/me resolves user and organization from the session', async () => {
  const api = buildApi();

  const token = await signToken({
    user: {
      id: 1
    },
    expires: new Date(
      Date.now() + 60 * 60 * 1000
    ).toISOString()
  });

  try {
    const response = await api.inject({
      method: 'GET',
      url: '/v1/me',
      headers: {
        cookie: `session=${token}`
      }
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();

    assert.equal(body.user.id, 1);
    assert.equal(typeof body.user.email, 'string');

    assert.ok(
      Number.isInteger(body.organization.id)
    );
    assert.equal(
      typeof body.organization.name,
      'string'
    );

    assert.equal(typeof body.role, 'string');
  } finally {
    await api.close();
  }
});
