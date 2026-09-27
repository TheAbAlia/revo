import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { createWorkerDb } from '@/lib/db/worker';
import {
  locations,
  organizations,
  providerConnections,
} from '@/lib/db/schema';
import { getProviderSyncContext } from '@/lib/integrations/providers/sync-context';

test('provider sync context enforces tenant boundaries', async () => {
  const workerDb = createWorkerDb();

  let organizationAId: number | null = null;
  let organizationBId: number | null = null;

  const suffix =
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const [organizationA] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Provider Sync Test A',
        slug: `provider-sync-test-a-${suffix}`,
      })
      .returning({
        id: organizations.id,
      });

    const [organizationB] = await workerDb.db
      .insert(organizations)
      .values({
        name: 'Provider Sync Test B',
        slug: `provider-sync-test-b-${suffix}`,
      })
      .returning({
        id: organizations.id,
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
        refreshTokenEncrypted: 'test-encrypted-token',
      })
      .returning({
        id: providerConnections.id,
      });

    assert.ok(connectionA);

    const [connectedLocation] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organizationA.id,
        name: 'Connected Location',
        provider: 'google',
        externalId: `location-connected-${suffix}`,
        providerConnectionId: connectionA.id,
      })
      .returning({
        id: locations.id,
      });

    const [unconnectedLocation] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organizationA.id,
        name: 'Unconnected Location',
        provider: 'google',
        externalId: `location-unconnected-${suffix}`,
      })
      .returning({
        id: locations.id,
      });

    const [crossTenantLocation] = await workerDb.db
      .insert(locations)
      .values({
        organizationId: organizationB.id,
        name: 'Cross Tenant Location',
        provider: 'google',
        externalId: `location-cross-tenant-${suffix}`,
        providerConnectionId: connectionA.id,
      })
      .returning({
        id: locations.id,
      });

    assert.ok(connectedLocation);
    assert.ok(unconnectedLocation);
    assert.ok(crossTenantLocation);

    const context = await getProviderSyncContext(
      workerDb.db,
      organizationA.id,
      connectedLocation.id
    );

    assert.equal(context.locationId, connectedLocation.id);
    assert.equal(context.provider, 'google');
    assert.equal(context.providerConnectionId, connectionA.id);
    assert.equal(
      context.externalAccountId,
      `account-${suffix}`
    );

    await assert.rejects(
      () =>
        getProviderSyncContext(
          workerDb.db,
          organizationB.id,
          connectedLocation.id
        ),
      /Location has no provider connection/
    );

    await assert.rejects(
      () =>
        getProviderSyncContext(
          workerDb.db,
          organizationA.id,
          unconnectedLocation.id
        ),
      /Location has no provider connection/
    );

    await assert.rejects(
      () =>
        getProviderSyncContext(
          workerDb.db,
          organizationB.id,
          crossTenantLocation.id
        ),
      /Location has no provider connection/
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
