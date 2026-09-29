import assert from 'node:assert/strict';
import test from 'node:test';
import { and, eq, sql } from 'drizzle-orm';

import { signToken } from '@/lib/auth/token';
import { createWorkerDb } from '@/lib/db/worker';
import {
  automationSettings,
  brandVoices,
  jobs,
  locations,
  organizationMembers,
  providerConnections,
  organizations,
  responses,
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

test('POST generation retry requeues a failed job', async () => {
  const workerDb = createWorkerDb();
  const suffix = `${Date.now()}-${process.pid}`;

  let userId: number | null = null;
  let organizationId: number | null = null;

  try {
    const [user] = await workerDb.db
      .insert(users)
      .values({
        name: 'API retry test user',
        email: `api-retry-${suffix}@example.test`,
        passwordHash: 'not-used-by-this-test'
      })
      .returning({
        id: users.id
      });

    assert.ok(user);
    userId = user.id;

    const [organization] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'API Retry Tenant',
        slug: `api-retry-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    assert.ok(organization);
    organizationId = organization.id;

    await workerDb.db
      .insert(organizationMembers)
      .values({
        organizationId: organization.id,
        userId: user.id,
        role: 'owner'
      });

    const [location] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organization.id,
        name: 'Retry Location'
      })
      .returning({
        id: locations.id
      });

    assert.ok(location);

    const [review] = await workerDb.db
      .insert(reviews)
      .values({
        organizationId: organization.id,
        locationId: location.id,
        provider: 'google',
        externalId: `retry-review-${suffix}`,
        authorName: 'Retry Reviewer',
        authorInitials: 'RR',
        rating: 5,
        content: 'Retry generation review',
        receivedAt: new Date()
      })
      .returning({
        id: reviews.id
      });

    assert.ok(review);

    const dedupeKey =
      `generate-ai-draft:${organization.id}:${review.id}`;

    await workerDb.db.insert(jobs).values({
      organizationId: organization.id,
      type: 'generate-ai-draft',
      payload: {
        reviewId: review.id,
        force: true
      },
      dedupeKey,
      status: 'failed',
      attempts: 3,
      lastError: 'Test generation failure'
    });

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
      const response = await api.inject({
        method: 'POST',
        url:
          `/v1/reviews/${review.id}/generate/retry`,
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(response.statusCode, 200);

      const [retriedJob] = await workerDb.db
        .select({
          status: jobs.status,
          attempts: jobs.attempts,
          payload: jobs.payload,
          lockedAt: jobs.lockedAt,
          lockedBy: jobs.lockedBy,
          lastError: jobs.lastError
        })
        .from(jobs)
        .where(eq(jobs.dedupeKey, dedupeKey))
        .limit(1);

      assert.ok(retriedJob);
      assert.equal(retriedJob.status, 'pending');
      assert.equal(retriedJob.attempts, 0);
      assert.equal(retriedJob.lockedAt, null);
      assert.equal(retriedJob.lockedBy, null);
      assert.equal(retriedJob.lastError, null);
      assert.deepEqual(retriedJob.payload, {
        reviewId: review.id,
        force: true
      });
    } finally {
      await api.close();
    }
  } finally {
    if (organizationId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(
          eq(organizations.id, organizationId)
        );
    }

    if (userId !== null) {
      await workerDb.db
        .delete(users)
        .where(eq(users.id, userId));
    }

    await workerDb.client.end();
  }
});

test('response mutations are tenant scoped and preserve state transitions', async () => {
  const workerDb = createWorkerDb();
  const suffix = `${Date.now()}-${process.pid}`;

  let userId: number | null = null;
  let organizationAId: number | null = null;
  let organizationBId: number | null = null;

  try {
    const [user] = await workerDb.db
      .insert(users)
      .values({
        name: 'Response mutation test user',
        email: `response-mutation-${suffix}@example.test`,
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
        name: 'Response Mutation Tenant A',
        slug: `response-mutation-a-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    const [organizationB] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Response Mutation Tenant B',
        slug: `response-mutation-b-${suffix}`
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

    const [providerConnectionA] =
      await workerDb.db
        .insert(providerConnections)
        .values({
          organizationId: organizationA.id,
          provider: 'google',
          externalAccountId:
            `publish-account-${suffix}`,
          refreshTokenEncrypted:
            'test-encrypted-refresh-token'
        })
        .returning({
          id: providerConnections.id
        });

    assert.ok(providerConnectionA);

    const [locationA] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organizationA.id,
        name: 'Mutation Location A',
        provider: 'google',
        externalId:
          `google-location-${suffix}`,
        providerConnectionId:
          providerConnectionA.id
      })
      .returning({
        id: locations.id
      });

    const [locationB] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organizationB.id,
        name: 'Mutation Location B'
      })
      .returning({
        id: locations.id
      });

    assert.ok(locationA);
    assert.ok(locationB);

    const [reviewA] = await workerDb.db
      .insert(reviews)
      .values({
        organizationId: organizationA.id,
        locationId: locationA.id,
        provider: 'google',
        externalId: `mutation-a-${suffix}`,
        authorName: 'Mutation Reviewer A',
        authorInitials: 'MA',
        rating: 5,
        content: 'Tenant A mutation review',
        receivedAt: new Date()
      })
      .returning({
        id: reviews.id
      });

    const [reviewB] = await workerDb.db
      .insert(reviews)
      .values({
        organizationId: organizationB.id,
        locationId: locationB.id,
        provider: 'google',
        externalId: `mutation-b-${suffix}`,
        authorName: 'Mutation Reviewer B',
        authorInitials: 'MB',
        rating: 4,
        content: 'Tenant B mutation review',
        receivedAt: new Date()
      })
      .returning({
        id: reviews.id
      });

    assert.ok(reviewA);
    assert.ok(reviewB);

    await workerDb.db.insert(responses).values([
      {
        organizationId: organizationA.id,
        reviewId: reviewA.id,
        content: 'Original A',
        status: 'approved',
        approvedAt: new Date(),
        publishedAt: new Date()
      },
      {
        organizationId: organizationB.id,
        reviewId: reviewB.id,
        content: 'Original B',
        status: 'draft'
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
      const saveResponse = await api.inject({
        method: 'PUT',
        url: `/v1/reviews/${reviewA.id}/response`,
        headers: {
          cookie: `session=${token}`
        },
        payload: {
          content: '  Edited draft A  '
        }
      });

      assert.equal(saveResponse.statusCode, 200);

      const [saved] = await workerDb.db
        .select()
        .from(responses)
        .where(
          and(
            eq(
              responses.organizationId,
              organizationA.id
            ),
            eq(responses.reviewId, reviewA.id)
          )
        )
        .limit(1);

      assert.ok(saved);
      assert.equal(saved.content, 'Edited draft A');
      assert.equal(saved.status, 'draft');
      assert.equal(saved.approvedAt, null);
      assert.equal(saved.publishedAt, null);

      const approveResponse = await api.inject({
        method: 'POST',
        url:
          `/v1/reviews/${reviewA.id}/response/approve`,
        headers: {
          cookie: `session=${token}`
        },
        payload: {
          content: '  Approved A  '
        }
      });

      assert.equal(approveResponse.statusCode, 200);

      const [approved] = await workerDb.db
        .select()
        .from(responses)
        .where(
          and(
            eq(
              responses.organizationId,
              organizationA.id
            ),
            eq(responses.reviewId, reviewA.id)
          )
        )
        .limit(1);

      assert.ok(approved);
      assert.equal(approved.content, 'Approved A');
      assert.equal(approved.status, 'approved');
      assert.ok(approved.approvedAt);
      assert.equal(approved.publishedAt, null);

      const publishResponse = await api.inject({
        method: 'POST',
        url:
          `/v1/reviews/${reviewA.id}/response/publish`,
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(publishResponse.statusCode, 200);

      const [publishJob] = await workerDb.db
        .select({
          organizationId: jobs.organizationId,
          type: jobs.type,
          payload: jobs.payload,
          status: jobs.status
        })
        .from(jobs)
        .where(
          and(
            eq(
              jobs.organizationId,
              organizationA.id
            ),
            eq(jobs.type, 'publish-response')
          )
        )
        .limit(1);

      assert.ok(publishJob);
      assert.equal(
        publishJob.organizationId,
        organizationA.id
      );
      assert.equal(
        publishJob.type,
        'publish-response'
      );
      assert.equal(publishJob.status, 'pending');
      assert.deepEqual(publishJob.payload, {
        responseId: approved.id
      });

      await workerDb.db
        .update(responses)
        .set({
          status: 'draft',
          approvedAt: null
        })
        .where(
          and(
            eq(
              responses.organizationId,
              organizationA.id
            ),
            eq(responses.reviewId, reviewA.id)
          )
        );

      const unapprovedPublish = await api.inject({
        method: 'POST',
        url:
          `/v1/reviews/${reviewA.id}/response/publish`,
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(
        unapprovedPublish.statusCode,
        409
      );

      await workerDb.db
        .update(responses)
        .set({
          status: 'approved',
          approvedAt: new Date()
        })
        .where(
          and(
            eq(
              responses.organizationId,
              organizationA.id
            ),
            eq(responses.reviewId, reviewA.id)
          )
        );

      await workerDb.db
        .update(locations)
        .set({
          providerConnectionId: null
        })
        .where(eq(locations.id, locationA.id));

      const disconnectedPublish =
        await api.inject({
          method: 'POST',
          url:
            `/v1/reviews/${reviewA.id}/response/publish`,
          headers: {
            cookie: `session=${token}`
          }
        });

      assert.equal(
        disconnectedPublish.statusCode,
        409
      );

      await workerDb.db
        .update(locations)
        .set({
          providerConnectionId:
            providerConnectionA.id
        })
        .where(eq(locations.id, locationA.id));

      const crossTenantPublish = await api.inject({
        method: 'POST',
        url:
          `/v1/reviews/${reviewB.id}/response/publish`,
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(
        crossTenantPublish.statusCode,
        404
      );

      const [crossTenantPublishJob] =
        await workerDb.db
          .select({
            id: jobs.id
          })
          .from(jobs)
          .where(
            and(
              eq(
                jobs.organizationId,
                organizationA.id
              ),
              eq(
                sql`${jobs.payload}->>'responseId'`,
                String(
                  (
                    await workerDb.db
                      .select({
                        id: responses.id
                      })
                      .from(responses)
                      .where(
                        and(
                          eq(
                            responses.organizationId,
                            organizationB.id
                          ),
                          eq(
                            responses.reviewId,
                            reviewB.id
                          )
                        )
                      )
                      .limit(1)
                  )[0]?.id
                )
              )
            )
          )
          .limit(1);

      assert.equal(
        crossTenantPublishJob,
        undefined
      );

      const crossTenantSave = await api.inject({
        method: 'PUT',
        url: `/v1/reviews/${reviewB.id}/response`,
        headers: {
          cookie: `session=${token}`
        },
        payload: {
          content: 'Should never be written'
        }
      });

      assert.equal(crossTenantSave.statusCode, 404);

      const crossTenantApprove = await api.inject({
        method: 'POST',
        url:
          `/v1/reviews/${reviewB.id}/response/approve`,
        headers: {
          cookie: `session=${token}`
        },
        payload: {
          content: 'Should never be approved'
        }
      });

      assert.equal(
        crossTenantApprove.statusCode,
        404
      );

      const [untouchedB] = await workerDb.db
        .select()
        .from(responses)
        .where(
          and(
            eq(
              responses.organizationId,
              organizationB.id
            ),
            eq(responses.reviewId, reviewB.id)
          )
        )
        .limit(1);

      assert.ok(untouchedB);
      assert.equal(untouchedB.content, 'Original B');
      assert.equal(untouchedB.status, 'draft');
    } finally {
      await api.close();
    }
  } finally {
    if (organizationAId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(
          eq(organizations.id, organizationAId)
        );
    }

    if (organizationBId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(
          eq(organizations.id, organizationBId)
        );
    }

    if (userId !== null) {
      await workerDb.db
        .delete(users)
        .where(eq(users.id, userId));
    }

    await workerDb.client.end();
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

    const [providerConnectionA] =
      await workerDb.db
        .insert(providerConnections)
        .values({
          organizationId: organizationA.id,
          provider: 'google',
          externalAccountId:
            `publish-account-${suffix}`,
          refreshTokenEncrypted:
            'test-encrypted-refresh-token'
        })
        .returning({
          id: providerConnections.id
        });

    const [providerConnectionB] =
      await workerDb.db
        .insert(providerConnections)
        .values({
          organizationId: organizationB.id,
          provider: 'google',
          externalAccountId:
            `foreign-account-${suffix}`,
          refreshTokenEncrypted:
            'test-encrypted-foreign-refresh-token'
        })
        .returning({
          id: providerConnections.id
        });

    assert.ok(providerConnectionA);
    assert.ok(providerConnectionB);

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

    const [reviewA] = await workerDb.db
      .insert(reviews)
      .values({
        organizationId: organizationA.id,
        locationId: locationA.id,
        provider: 'google',
        externalId: `tenant-a-review-${suffix}`,
        authorName: 'Tenant A Reviewer',
        authorInitials: 'TA',
        rating: 5,
        content: 'Tenant A review',
        receivedAt: new Date()
      })
      .returning({
        id: reviews.id
      });

    assert.ok(reviewA);

    const [reviewB] = await workerDb.db
      .insert(reviews)
      .values({
        organizationId: organizationB.id,
        locationId: locationB.id,
        provider: 'google',
        externalId: `tenant-b-review-1-${suffix}`,
        authorName: 'Tenant B Reviewer One',
        authorInitials: 'B1',
        rating: 4,
        content: 'Tenant B review one',
        receivedAt: new Date()
      })
      .returning({
        id: reviews.id
      });

    assert.ok(reviewB);

    await workerDb.db.insert(reviews).values([
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

      const locationsResponse = await api.inject({
        method: 'GET',
        url: '/v1/locations',
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(
        locationsResponse.statusCode,
        200
      );

      const locationsBody =
        locationsResponse.json();

      assert.equal(
        locationsBody.locations.length,
        1
      );
      assert.equal(
        locationsBody.locations[0].id,
        locationA.id
      );
      assert.equal(
        locationsBody.locations[0].name,
        'Tenant A Location'
      );
      assert.equal(
        locationsBody.locations[0].reviewCount,
        1
      );
      assert.equal(
        locationsBody.locations[0]
          .needsResponseCount,
        1
      );
      assert.equal(
        locationsBody.locations[0]
          .respondedCount,
        0
      );

      assert.equal(
        locationsBody.locations.some(
          (location: {
            id: number;
          }) => location.id === locationB.id
        ),
        false
      );

      const createLocationResponse =
        await api.inject({
          method: 'POST',
          url: '/v1/locations',
          headers: {
            cookie: `session=${token}`
          },
          payload: {
            name: '  API Created Location  '
          }
        });

      assert.equal(
        createLocationResponse.statusCode,
        200
      );

      const createLocationBody =
        createLocationResponse.json();

      assert.equal(
        createLocationBody.location.name,
        'API Created Location'
      );

      const [createdLocation] =
        await workerDb.db
          .select({
            id: locations.id,
            organizationId:
              locations.organizationId,
            name: locations.name
          })
          .from(locations)
          .where(
            eq(
              locations.id,
              createLocationBody.location.id
            )
          )
          .limit(1);

      assert.ok(createdLocation);
      assert.equal(
        createdLocation.organizationId,
        organizationA.id
      );
      assert.equal(
        createdLocation.name,
        'API Created Location'
      );

      const syncOwnUnconnectedResponse =
        await api.inject({
          method: 'POST',
          url:
            `/v1/locations/${locationA.id}/sync`,
          headers: {
            cookie: `session=${token}`
          }
        });

      assert.equal(
        syncOwnUnconnectedResponse.statusCode,
        409
      );

      const syncOtherTenantResponse =
        await api.inject({
          method: 'POST',
          url:
            `/v1/locations/${locationB.id}/sync`,
          headers: {
            cookie: `session=${token}`
          }
        });

      assert.equal(
        syncOtherTenantResponse.statusCode,
        404
      );

      const [crossTenantSyncJob] =
        await workerDb.db
          .select({
            id: jobs.id
          })
          .from(jobs)
          .where(
            eq(
              jobs.dedupeKey,
              `sync-provider-reviews:${organizationA.id}:${locationB.id}`
            )
          )
          .limit(1);

      assert.equal(
        crossTenantSyncJob,
        undefined
      );

      const ownConnectionResponse =
        await api.inject({
          method: 'GET',
          url:
            `/v1/provider-connections/google/${providerConnectionA.id}`,
          headers: {
            cookie: `session=${token}`
          }
        });

      assert.equal(
        ownConnectionResponse.statusCode,
        200
      );

      assert.equal(
        ownConnectionResponse.json()
          .connection.externalAccountId,
        `publish-account-${suffix}`
      );

      const foreignConnectionResponse =
        await api.inject({
          method: 'GET',
          url:
            `/v1/provider-connections/google/${providerConnectionB.id}`,
          headers: {
            cookie: `session=${token}`
          }
        });

      assert.equal(
        foreignConnectionResponse.statusCode,
        404
      );

      const oauthAccountId =
        `oauth-account-${suffix}`;

      const upsertConnectionResponse =
        await api.inject({
          method: 'POST',
          url:
            '/v1/provider-connections/google',
          headers: {
            cookie: `session=${token}`,
            'content-type': 'application/json'
          },
          payload: {
            externalAccountId: oauthAccountId,
            refreshToken:
              'test-oauth-refresh-token'
          }
        });

      assert.equal(
        upsertConnectionResponse.statusCode,
        200
      );

      const [persistedOAuthConnection] =
        await workerDb.db
          .select({
            organizationId:
              providerConnections.organizationId,
            externalAccountId:
              providerConnections.externalAccountId,
            refreshTokenEncrypted:
              providerConnections.refreshTokenEncrypted
          })
          .from(providerConnections)
          .where(
            and(
              eq(
                providerConnections.organizationId,
                organizationA.id
              ),
              eq(
                providerConnections.externalAccountId,
                oauthAccountId
              )
            )
          )
          .limit(1);

      assert.ok(persistedOAuthConnection);

      assert.equal(
        persistedOAuthConnection.organizationId,
        organizationA.id
      );

      assert.notEqual(
        persistedOAuthConnection.refreshTokenEncrypted,
        'test-oauth-refresh-token'
      );

      const [crossTenantOAuthConnection] =
        await workerDb.db
          .select({
            id: providerConnections.id
          })
          .from(providerConnections)
          .where(
            and(
              eq(
                providerConnections.organizationId,
                organizationB.id
              ),
              eq(
                providerConnections.externalAccountId,
                oauthAccountId
              )
            )
          )
          .limit(1);

      assert.equal(
        crossTenantOAuthConnection,
        undefined
      );

      const generateOwnResponse = await api.inject({
        method: 'POST',
        url: `/v1/reviews/${reviewA.id}/generate`,
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(
        generateOwnResponse.statusCode,
        200
      );

      const [ownJob] = await workerDb.db
        .select({
          organizationId: jobs.organizationId,
          payload: jobs.payload
        })
        .from(jobs)
        .where(
          eq(
            jobs.dedupeKey,
            `generate-ai-draft:${organizationA.id}:${reviewA.id}`
          )
        )
        .limit(1);

      assert.ok(ownJob);
      assert.equal(
        ownJob.organizationId,
        organizationA.id
      );

      const generateOtherResponse = await api.inject({
        method: 'POST',
        url: `/v1/reviews/${reviewB.id}/generate`,
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(
        generateOtherResponse.statusCode,
        404
      );

      const [crossTenantJob] = await workerDb.db
        .select({
          id: jobs.id
        })
        .from(jobs)
        .where(
          eq(
            jobs.dedupeKey,
            `generate-ai-draft:${organizationA.id}:${reviewB.id}`
          )
        )
        .limit(1);

      assert.equal(crossTenantJob, undefined);


      const retryNonFailedResponse = await api.inject({
        method: 'POST',
        url:
          `/v1/reviews/${reviewA.id}/generate/retry`,
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(
        retryNonFailedResponse.statusCode,
        409
      );

      const retryOtherTenantResponse =
        await api.inject({
          method: 'POST',
          url:
            `/v1/reviews/${reviewB.id}/generate/retry`,
          headers: {
            cookie: `session=${token}`
          }
        });

      assert.equal(
        retryOtherTenantResponse.statusCode,
        404
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

test('Brand Voice API is tenant scoped', async () => {
  const workerDb = createWorkerDb();
  const suffix = `${Date.now()}-${process.pid}`;

  let userId: number | null = null;
  let organizationAId: number | null = null;
  let organizationBId: number | null = null;

  try {
    const [user] = await workerDb.db
      .insert(users)
      .values({
        name: 'Brand Voice API test user',
        email: `brand-voice-${suffix}@example.test`,
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
        name: 'Brand Voice Tenant A',
        slug: `brand-voice-a-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    const [organizationB] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Brand Voice Tenant B',
        slug: `brand-voice-b-${suffix}`
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

    await workerDb.db
      .insert(brandVoices)
      .values([
        {
          organizationId: organizationA.id,
          name: 'Tenant A Voice',
          instructions: 'Tenant A instructions',
          isDefault: true
        },
        {
          organizationId: organizationB.id,
          name: 'Tenant B Voice',
          instructions: 'Tenant B instructions',
          isDefault: true
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
      const getResponse = await api.inject({
        method: 'GET',
        url: '/v1/brand-voice',
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(getResponse.statusCode, 200);

      const getBody = getResponse.json();

      assert.equal(
        getBody.organization.id,
        organizationA.id
      );

      assert.equal(
        getBody.brandVoice.name,
        'Tenant A Voice'
      );

      assert.equal(
        getBody.brandVoice.instructions,
        'Tenant A instructions'
      );

      const updateResponse = await api.inject({
        method: 'PUT',
        url: '/v1/brand-voice',
        headers: {
          cookie: `session=${token}`,
          'content-type': 'application/json'
        },
        payload: {
          name: 'Updated Tenant A Voice',
          instructions:
            'Updated Tenant A instructions'
        }
      });

      assert.equal(updateResponse.statusCode, 200);

      const [tenantAVoice] = await workerDb.db
        .select({
          name: brandVoices.name,
          instructions: brandVoices.instructions
        })
        .from(brandVoices)
        .where(
          and(
            eq(
              brandVoices.organizationId,
              organizationA.id
            ),
            eq(brandVoices.isDefault, true)
          )
        )
        .limit(1);

      assert.ok(tenantAVoice);

      assert.equal(
        tenantAVoice.name,
        'Updated Tenant A Voice'
      );

      assert.equal(
        tenantAVoice.instructions,
        'Updated Tenant A instructions'
      );

      const [tenantBVoice] = await workerDb.db
        .select({
          name: brandVoices.name,
          instructions: brandVoices.instructions
        })
        .from(brandVoices)
        .where(
          and(
            eq(
              brandVoices.organizationId,
              organizationB.id
            ),
            eq(brandVoices.isDefault, true)
          )
        )
        .limit(1);

      assert.ok(tenantBVoice);

      assert.equal(
        tenantBVoice.name,
        'Tenant B Voice'
      );

      assert.equal(
        tenantBVoice.instructions,
        'Tenant B instructions'
      );
    } finally {
      await api.close();
    }
  } finally {
    if (organizationBId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(
          eq(organizations.id, organizationBId)
        );
    }

    if (organizationAId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(
          eq(organizations.id, organizationAId)
        );
    }

    if (userId !== null) {
      await workerDb.db
        .delete(users)
        .where(eq(users.id, userId));
    }

    await workerDb.client.end();
  }
});

test('Automations API is tenant scoped', async () => {
  const workerDb = createWorkerDb();
  const suffix = `${Date.now()}-${process.pid}`;

  let userId: number | null = null;
  let organizationAId: number | null = null;
  let organizationBId: number | null = null;

  try {
    const [user] = await workerDb.db
      .insert(users)
      .values({
        name: 'Automations API test user',
        email: `automations-${suffix}@example.test`,
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
        name: 'Automations Tenant A',
        slug: `automations-a-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    const [organizationB] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Automations Tenant B',
        slug: `automations-b-${suffix}`
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

    await workerDb.db
      .insert(automationSettings)
      .values({
        organizationId: organizationB.id,
        autoGenerateDrafts: true
      });

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
      const getResponse = await api.inject({
        method: 'GET',
        url: '/v1/automations',
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(getResponse.statusCode, 200);

      const getBody = getResponse.json();

      assert.equal(
        getBody.settings.autoGenerateDrafts,
        false
      );

      const updateResponse = await api.inject({
        method: 'PUT',
        url: '/v1/automations',
        headers: {
          cookie: `session=${token}`,
          'content-type': 'application/json'
        },
        payload: {
          autoGenerateDrafts: true
        }
      });

      assert.equal(updateResponse.statusCode, 200);

      const [tenantASettings] = await workerDb.db
        .select({
          autoGenerateDrafts:
            automationSettings.autoGenerateDrafts
        })
        .from(automationSettings)
        .where(
          eq(
            automationSettings.organizationId,
            organizationA.id
          )
        )
        .limit(1);

      assert.ok(tenantASettings);
      assert.equal(
        tenantASettings.autoGenerateDrafts,
        true
      );

      const [tenantBSettings] = await workerDb.db
        .select({
          autoGenerateDrafts:
            automationSettings.autoGenerateDrafts
        })
        .from(automationSettings)
        .where(
          eq(
            automationSettings.organizationId,
            organizationB.id
          )
        )
        .limit(1);

      assert.ok(tenantBSettings);
      assert.equal(
        tenantBSettings.autoGenerateDrafts,
        true
      );

      const disableResponse = await api.inject({
        method: 'PUT',
        url: '/v1/automations',
        headers: {
          cookie: `session=${token}`,
          'content-type': 'application/json'
        },
        payload: {
          autoGenerateDrafts: false
        }
      });

      assert.equal(disableResponse.statusCode, 200);

      const [disabledTenantASettings] =
        await workerDb.db
          .select({
            autoGenerateDrafts:
              automationSettings.autoGenerateDrafts
          })
          .from(automationSettings)
          .where(
            eq(
              automationSettings.organizationId,
              organizationA.id
            )
          )
          .limit(1);

      assert.ok(disabledTenantASettings);
      assert.equal(
        disabledTenantASettings.autoGenerateDrafts,
        false
      );
    } finally {
      await api.close();
    }
  } finally {
    if (organizationBId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(
          eq(organizations.id, organizationBId)
        );
    }

    if (organizationAId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(
          eq(organizations.id, organizationAId)
        );
    }

    if (userId !== null) {
      await workerDb.db
        .delete(users)
        .where(eq(users.id, userId));
    }

    await workerDb.client.end();
  }
});

test('Analytics API is tenant scoped', async () => {
  const workerDb = createWorkerDb();
  const suffix = `${Date.now()}-${process.pid}`;

  let userId: number | null = null;
  let organizationAId: number | null = null;
  let organizationBId: number | null = null;

  try {
    const [user] = await workerDb.db
      .insert(users)
      .values({
        name: 'Analytics API test user',
        email: `analytics-${suffix}@example.test`,
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
        name: 'Analytics Tenant A',
        slug: `analytics-a-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    const [organizationB] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Analytics Tenant B',
        slug: `analytics-b-${suffix}`
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
        name: 'Analytics Location A'
      })
      .returning({
        id: locations.id
      });

    const [locationB] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organizationB.id,
        name: 'Analytics Location B'
      })
      .returning({
        id: locations.id
      });

    assert.ok(locationA);
    assert.ok(locationB);

    const tenantAReviews = await workerDb.db
      .insert(reviews)
      .values([
        {
          organizationId: organizationA.id,
          locationId: locationA.id,
          provider: 'google',
          externalId: `analytics-a-1-${suffix}`,
          authorName: 'Analytics Reviewer A1',
          authorInitials: 'A1',
          rating: 5,
          content: 'Tenant A five star review',
          receivedAt: new Date()
        },
        {
          organizationId: organizationA.id,
          locationId: locationA.id,
          provider: 'google',
          externalId: `analytics-a-2-${suffix}`,
          authorName: 'Analytics Reviewer A2',
          authorInitials: 'A2',
          rating: 3,
          content: 'Tenant A three star review',
          receivedAt: new Date()
        }
      ])
      .returning({
        id: reviews.id
      });

    assert.equal(tenantAReviews.length, 2);

    await workerDb.db.insert(responses).values({
      organizationId: organizationA.id,
      reviewId: tenantAReviews[0].id,
      content: 'Tenant A response',
      status: 'approved',
      approvedAt: new Date()
    });

    await workerDb.db.insert(reviews).values({
      organizationId: organizationB.id,
      locationId: locationB.id,
      provider: 'google',
      externalId: `analytics-b-1-${suffix}`,
      authorName: 'Analytics Reviewer B',
      authorInitials: 'B',
      rating: 1,
      content: 'Tenant B review',
      receivedAt: new Date()
    });

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
      const response = await api.inject({
        method: 'GET',
        url: '/v1/analytics',
        headers: {
          cookie: `session=${token}`
        }
      });

      assert.equal(response.statusCode, 200);

      const body = response.json();
      const analytics = body.analytics;

      assert.equal(analytics.totalReviews, 2);
      assert.equal(analytics.averageRating, 4);
      assert.equal(analytics.respondedReviews, 1);
      assert.equal(analytics.needsResponse, 1);
      assert.equal(analytics.responseCoverage, 50);

      assert.deepEqual(
        analytics.ratingDistribution,
        [
          {
            rating: 3,
            count: 1
          },
          {
            rating: 5,
            count: 1
          }
        ]
      );

      assert.deepEqual(analytics.locations, [
        {
          id: locationA.id,
          name: 'Analytics Location A',
          totalReviews: 2,
          averageRating: 4,
          respondedReviews: 1
        }
      ]);

      assert.equal(
        analytics.locations.some(
          (location: { name: string }) =>
            location.name === 'Analytics Location B'
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
        .where(
          eq(organizations.id, organizationBId)
        );
    }

    if (organizationAId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(
          eq(organizations.id, organizationAId)
        );
    }

    if (userId !== null) {
      await workerDb.db
        .delete(users)
        .where(eq(users.id, userId));
    }

    await workerDb.client.end();
  }
});
