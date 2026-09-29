import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';

import { signToken } from '@/lib/auth/token';
import { createWorkerDb } from '@/lib/db/worker';
import {
  locations,
  organizationMembers,
  organizations,
  reviews,
  users
} from '@/lib/db/schema';
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

test('GET /v1/dashboard/shell rejects requests without a session', async () => {
  const api = buildApi();

  try {
    const response = await api.inject({
      method: 'GET',
      url: '/v1/dashboard/shell'
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {
      error: 'Unauthorized'
    });
  } finally {
    await api.close();
  }
});

test('GET /v1/dashboard/shell derives tenant scope from the session', async () => {
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
      url: '/v1/dashboard/shell',
      headers: {
        cookie: `session=${token}`
      }
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();

    assert.ok(
      Number.isInteger(body.organization.id)
    );
    assert.equal(
      typeof body.organization.name,
      'string'
    );
    assert.ok(
      Number.isInteger(body.inboxCount)
    );
    assert.ok(body.inboxCount >= 0);
  } finally {
    await api.close();
  }
});

test('GET /v1/reviews rejects requests without a session', async () => {
  const api = buildApi();

  try {
    const response = await api.inject({
      method: 'GET',
      url: '/v1/reviews'
    });

    assert.equal(response.statusCode, 401);
  } finally {
    await api.close();
  }
});

test('GET /v1/dashboard/shell excludes reviews from other tenants', async () => {
  const workerDb = createWorkerDb();
  const suffix = `${Date.now()}-${process.pid}`;

  let userId: number | null = null;
  let organizationAId: number | null = null;
  let organizationBId: number | null = null;

  try {
    const [user] = await workerDb.db
      .insert(users)
      .values({
        name: 'API tenant test user',
        email: `api-tenant-${suffix}@example.test`,
        passwordHash: 'not-used-by-this-test'
      })
      .returning({
        id: users.id
      });

    assert.ok(user);
    userId = user.id;

    const [organizationA] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'API Tenant A',
        slug: `api-tenant-a-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    const [organizationB] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'API Tenant B',
        slug: `api-tenant-b-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    assert.ok(organizationA);
    assert.ok(organizationB);

    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    await workerDb.db
      .insert(organizationMembers)
      .values({
        organizationId: organizationA.id,
        userId: user.id,
        role: 'owner'
      });

    const [locationA] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organizationA.id,
        name: 'Tenant A Location'
      })
      .returning({
        id: locations.id
      });

    const [locationB] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organizationB.id,
        name: 'Tenant B Location'
      })
      .returning({
        id: locations.id
      });

    assert.ok(locationA);
    assert.ok(locationB);

    await workerDb.db.insert(reviews).values({
      organizationId: organizationA.id,
      locationId: locationA.id,
      provider: 'google',
      externalId: `tenant-a-review-${suffix}`,
      authorName: 'Tenant A Reviewer',
      authorInitials: 'TA',
      rating: 5,
      content: 'Tenant A review',
      receivedAt: new Date()
    });

    await workerDb.db.insert(reviews).values([
      {
        organizationId: organizationB.id,
        locationId: locationB.id,
        provider: 'google',
        externalId: `tenant-b-review-1-${suffix}`,
        authorName: 'Tenant B Reviewer One',
        authorInitials: 'B1',
        rating: 4,
        content: 'Tenant B review one',
        receivedAt: new Date()
      },
      {
        organizationId: organizationB.id,
        locationId: locationB.id,
        provider: 'google',
        externalId: `tenant-b-review-2-${suffix}`,
        authorName: 'Tenant B Reviewer Two',
        authorInitials: 'B2',
        rating: 3,
        content: 'Tenant B review two',
        receivedAt: new Date()
      }
    ]);

    const token = await signToken({
      user: {
        id: user.id
      },
      expires: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString()
    });

    const api = buildApi();

    try {
      const shellResponse = await api.inject({
        method: 'GET',
        url: '/v1/dashboard/shell',
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(shellResponse.statusCode, 200);

      const shellBody = shellResponse.json();

      assert.equal(
        shellBody.organization.id,
        organizationA.id
      );
      assert.equal(shellBody.inboxCount, 1);

      const reviewsResponse = await api.inject({
        method: 'GET',
        url: '/v1/reviews',
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(reviewsResponse.statusCode, 200);

      const reviewsBody = reviewsResponse.json();

      assert.equal(reviewsBody.items.length, 1);
      assert.equal(
        reviewsBody.items[0].review.organizationId,
        String(organizationA.id)
      );
      assert.equal(
        reviewsBody.items[0].review.externalId,
        `tenant-a-review-${suffix}`
      );
      assert.equal(
        reviewsBody.items[0].review.content,
        'Tenant A review'
      );

      assert.equal(
        reviewsBody.items.some(
          (item: {
            review: {
              externalId: string;
            };
          }) =>
            item.review.externalId.startsWith(
              'tenant-b-review-'
            )
        ),
        false
      );
    } finally {
      await api.close();
    }
  } finally {
    if (organizationBId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(eq(organizations.id, organizationBId));
    }

    if (organizationAId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(eq(organizations.id, organizationAId));
    }

    if (userId !== null) {
      await workerDb.db
        .delete(users)
        .where(eq(users.id, userId));
    }

    await workerDb.client.end();
  }
});
