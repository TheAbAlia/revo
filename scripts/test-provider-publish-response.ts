import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { createWorkerDb } from '@/lib/db/worker';
import {
  locations,
  organizations,
  providerConnections,
  responses,
  reviews
} from '@/lib/db/schema';
import { publishProviderResponse } from '@/lib/integrations/providers/publish-response';

test('provider publishing publishes an approved Google response', async () => {
  const workerDb = createWorkerDb();
  let organizationId: number | null = null;

  const suffix =
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const [organization] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Provider Publish Integration Test',
        slug: `provider-publish-integration-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    assert.ok(organization);
    organizationId = organization.id;

    const [connection] = await workerDb.db
      .insert(providerConnections)
      .values({
        organizationId: organization.id,
        provider: 'google',
        externalAccountId: `account-${suffix}`,
        refreshTokenEncrypted: 'encrypted-test-token'
      })
      .returning({
        id: providerConnections.id
      });

    assert.ok(connection);

    const [location] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organization.id,
        name: 'Publish Integration Location',
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
        organizationId: organization.id,
        locationId: location.id,
        provider: 'google',
        externalId: `review-${suffix}`,
        authorName: 'Integration Reviewer',
        authorInitials: 'IR',
        rating: 5,
        content: 'Excellent.',
        receivedAt: new Date()
      })
      .returning({
        id: reviews.id
      });

    assert.ok(review);

    const [response] = await workerDb.db
      .insert(responses)
      .values({
        organizationId: organization.id,
        reviewId: review.id,
        content: 'Thank you very much!',
        status: 'approved',
        approvedAt: new Date()
      })
      .returning({
        id: responses.id
      });

    assert.ok(response);

    let decryptedValue: string | null = null;
    let refreshedValue: string | null = null;
    let googleInput: unknown = null;

    const result = await publishProviderResponse(
      workerDb.db,
      organization.id,
      response.id,
      {
        decryptCredential(encrypted) {
          decryptedValue = encrypted;
          return 'decrypted-refresh-token';
        },

        async refreshGoogleAccessToken(refreshToken) {
          refreshedValue = refreshToken;

          return {
            accessToken: 'test-access-token',
            expiresIn: 3600,
            scope: 'test-scope',
            tokenType: 'Bearer'
          };
        },

        async publishGoogleReviewResponse(input) {
          googleInput = input;

          return;
        }
      }
    );

    assert.equal(
      decryptedValue,
      'encrypted-test-token'
    );

    assert.equal(
      refreshedValue,
      'decrypted-refresh-token'
    );

    assert.deepEqual(googleInput, {
      accessToken: 'test-access-token',
      accountId: `account-${suffix}`,
      locationId: `location-${suffix}`,
      reviewId: `review-${suffix}`,
      content: 'Thank you very much!'
    });

    assert.equal(result.responseId, response.id);
    assert.equal(result.status, 'published');
    assert.ok(result.publishedAt instanceof Date);

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
  } finally {
    if (organizationId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(eq(organizations.id, organizationId));
    }

    await workerDb.client.end();
  }
});
