import assert from 'node:assert/strict';
import test from 'node:test';

import { eq, and } from 'drizzle-orm';

import { createWorkerDb } from '@/lib/db/worker';
import {
  jobs,
  locations,
  organizations,
  providerConnections,
  responses,
  reviews
} from '@/lib/db/schema';
import { encryptCredential } from '@/lib/integrations/crypto';
import { runNextJob } from '@/lib/jobs/run-next';

test('publish-response job flows through worker to Google', async () => {
  const workerDb = createWorkerDb();

  let organizationId: number | null = null;
  const originalFetch = globalThis.fetch;

  const suffix =
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const calls: Array<{
    url: string;
    method: string;
  }> = [];

  try {
    /*
     * Intercept only the external HTTP boundary.
     *
     * Everything before this remains real:
     * enqueue -> claim -> process -> provider context ->
     * decrypt -> OAuth refresh -> Google publish.
     */
    globalThis.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      calls.push({
        url,
        method: init?.method ?? 'GET'
      });

      if (url === 'https://oauth2.googleapis.com/token') {
        return new Response(
          JSON.stringify({
            access_token: 'e2e-access-token',
            expires_in: 3600,
            scope:
              'https://www.googleapis.com/auth/business.manage',
            token_type: 'Bearer'
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }

      if (
        url.includes(
          'https://mybusiness.googleapis.com/'
        )
      ) {
        return new Response(
          JSON.stringify({
            name: `accounts/account-${suffix}/locations/location-${suffix}/reviews/review-${suffix}/reply`
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }

      throw new Error(`Unexpected external request: ${url}`);
    };

    const [organization] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Publish E2E Test',
        slug: `publish-e2e-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    assert.ok(organization);
    organizationId = organization.id;

    const encryptedRefreshToken =
      encryptCredential('e2e-refresh-token');

    const [connection] = await workerDb.db
      .insert(providerConnections)
      .values({
        organizationId,
        provider: 'google',
        externalAccountId: `account-${suffix}`,
        refreshTokenEncrypted: encryptedRefreshToken
      })
      .returning({
        id: providerConnections.id
      });

    assert.ok(connection);

    const [location] = await workerDb.db
      .insert(locations)
      .values({
        organizationId,
        name: 'Publish E2E Location',
        provider: 'google',
        externalId: `location-${suffix}`,
        providerConnectionId: connection.id
      })
      .returning({
        id: locations.id
      });

    assert.ok(location);

    const [review] = await workerDb.db
      .insert(reviews)
      .values({
        organizationId,
        locationId: location.id,
        provider: 'google',
        externalId: `review-${suffix}`,
        authorName: 'E2E Reviewer',
        authorInitials: 'ER',
        rating: 5,
        content: 'Excellent service.',
        receivedAt: new Date()
      })
      .returning({
        id: reviews.id
      });

    assert.ok(review);

    const [response] = await workerDb.db
      .insert(responses)
      .values({
        organizationId,
        reviewId: review.id,
        content: 'Thank you for your review!',
        status: 'approved',
        approvedAt: new Date()
      })
      .returning({
        id: responses.id
      });

    assert.ok(response);

    /*
     * This is the important boundary:
     * enqueue the actual publish-response job.
     */
    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId,
        type: 'publish-response',
        payload: {
          responseId: response.id
        },
        dedupeKey: `publish-e2e:${response.id}`,
        availableAt: new Date()
      })
      .returning({
        id: jobs.id,
        type: jobs.type,
        status: jobs.status
      });

    assert.ok(job);
    assert.equal(job.type, 'publish-response');
    assert.equal(job.status, 'pending');

    /*
     * Run the actual worker.
     */
    const result = await runNextJob(
      workerDb.db,
      'publish-e2e-worker'
    );

    assert.deepEqual(result, {
      status: 'completed',
      jobId: job.id
    });

    /*
     * Verify the job lifecycle.
     */
    const [storedJob] = await workerDb.db
      .select({
        status: jobs.status,
        attempts: jobs.attempts,
        lockedAt: jobs.lockedAt,
        lockedBy: jobs.lockedBy,
        lastError: jobs.lastError
      })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1);

    assert.ok(storedJob);
    assert.equal(storedJob.status, 'completed');
    assert.equal(storedJob.attempts, 1);
    assert.equal(storedJob.lockedAt, null);
    assert.equal(storedJob.lockedBy, null);
    assert.equal(storedJob.lastError, null);

    /*
     * Verify the response itself was published.
     */
    const [storedResponse] = await workerDb.db
      .select({
        status: responses.status,
        publishedAt: responses.publishedAt
      })
      .from(responses)
      .where(eq(responses.id, response.id))
      .limit(1);

    assert.ok(storedResponse);
    assert.equal(storedResponse.status, 'published');
    assert.ok(storedResponse.publishedAt instanceof Date);

    /*
     * Verify the real encrypted credential path was exercised
     * indirectly through the successful OAuth refresh.
     */
    assert.equal(
      calls.filter(
        (call) =>
          call.url ===
          'https://oauth2.googleapis.com/token'
      ).length,
      1
    );

    assert.equal(
      calls.filter((call) =>
        call.url.includes(
          'https://mybusiness.googleapis.com/'
        )
      ).length,
      1
    );
  } finally {
    globalThis.fetch = originalFetch;

    if (organizationId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(
          eq(organizations.id, organizationId)
        );
    }

    await workerDb.client.end();
  }
});
