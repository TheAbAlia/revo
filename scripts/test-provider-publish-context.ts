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
import { getProviderPublishContext } from '@/lib/integrations/providers/publish-context';

test('provider publish context enforces tenant boundaries', async () => {
  const workerDb = createWorkerDb();

  let organizationAId: number | null = null;
  let organizationBId: number | null = null;

  const suffix =
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const [organizationA] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Provider Publish Test A',
        slug: `provider-publish-test-a-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    const [organizationB] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Provider Publish Test B',
        slug: `provider-publish-test-b-${suffix}`
      })
      .returning({
        id: organizations.id
      });

    assert.ok(organizationA);
    assert.ok(organizationB);

    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const [connectionA] = await workerDb.db
      .insert(providerConnections)
      .values({
        organizationId: organizationA.id,
        provider: 'google',
        externalAccountId: `account-${suffix}`,
        refreshTokenEncrypted: 'test-encrypted-token'
      })
      .returning({
        id: providerConnections.id
      });

    assert.ok(connectionA);

    const [locationA] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organizationA.id,
        name: 'Publish Test Location',
        provider: 'google',
        externalId: `location-${suffix}`,
        providerConnectionId: connectionA.id
      })
      .returning({
        id: locations.id
      });

    assert.ok(locationA);

    const [reviewA] = await workerDb.db
      .insert(reviews)
      .values({
        organizationId: organizationA.id,
        locationId: locationA.id,
        provider: 'google',
        externalId: `review-${suffix}`,
        authorName: 'Publish Test Reviewer',
        authorInitials: 'PT',
        rating: 5,
        content: 'Great service.',
        receivedAt: new Date()
      })
      .returning({
        id: reviews.id
      });

    assert.ok(reviewA);

    const [responseA] = await workerDb.db
      .insert(responses)
      .values({
        organizationId: organizationA.id,
        reviewId: reviewA.id,
        content: 'Thank you for your review!',
        status: 'approved',
        approvedAt: new Date()
      })
      .returning({
        id: responses.id
      });

    assert.ok(responseA);

    const context = await getProviderPublishContext(
      workerDb.db,
      organizationA.id,
      responseA.id
    );

    assert.equal(context.responseId, responseA.id);
    assert.equal(context.reviewId, reviewA.id);
    assert.equal(context.reviewExternalId, `review-${suffix}`);
    assert.equal(context.locationId, locationA.id);
    assert.equal(context.provider, 'google');
    assert.equal(context.locationExternalId, `location-${suffix}`);
    assert.equal(
      context.providerConnectionId,
      connectionA.id
    );
    assert.equal(
      context.externalAccountId,
      `account-${suffix}`
    );

    await assert.rejects(
      () =>
        getProviderPublishContext(
          workerDb.db,
          organizationB.id,
          responseA.id
        ),
      /Response has no provider connection/
    );

    await workerDb.db
      .update(responses)
      .set({
        status: 'draft',
        approvedAt: null
      })
      .where(eq(responses.id, responseA.id));

    await assert.rejects(
      () =>
        getProviderPublishContext(
          workerDb.db,
          organizationA.id,
          responseA.id
        ),
      /Response is not approved/
    );
  } finally {
    if (organizationAId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(eq(organizations.id, organizationAId));
    }

    if (organizationBId !== null) {
      await workerDb.db
        .delete(organizations)
        .where(eq(organizations.id, organizationBId));
    }

    await workerDb.client.end();
  }
});
