import assert from 'node:assert/strict';
import test from 'node:test';

import { and, eq } from 'drizzle-orm';

import { createWorkerDb } from '@/lib/db/worker';
import {
  jobs,
  locations,
  organizations,
  providerConnections
} from '@/lib/db/schema';
import {
  enqueueDueProviderSyncs,
  PROVIDER_SYNC_INTERVAL_MS
} from '@/lib/integrations/providers/schedule-syncs';

test('provider sync scheduler enqueues only due healthy locations and deduplicates active jobs', async () => {
  const { db, client } = createWorkerDb();

  const now = new Date('2026-09-29T12:00:00.000Z');
  const staleAttempt = new Date(
    now.getTime() - PROVIDER_SYNC_INTERVAL_MS - 60_000
  );
  const recentAttempt = new Date(
    now.getTime() - PROVIDER_SYNC_INTERVAL_MS + 60_000
  );

  let organizationId: number | undefined;

  try {
    const [organization] = await db
      .insert(organizations)
      .values({
        name: 'Provider Scheduler Test',
        slug: `provider-scheduler-test-${Date.now()}`
      })
      .returning({
        id: organizations.id
      });

    organizationId = organization.id;

    const [healthyConnection] = await db
      .insert(providerConnections)
      .values({
        organizationId,
        provider: 'google',
        externalAccountId: 'accounts/scheduler-healthy',
        refreshTokenEncrypted: 'test-token',
        status: 'connected'
      })
      .returning({
        id: providerConnections.id
      });

    const [reauthConnection] = await db
      .insert(providerConnections)
      .values({
        organizationId,
        provider: 'google',
        externalAccountId: 'accounts/scheduler-reauth',
        refreshTokenEncrypted: 'test-token',
        status: 'needs_reauth'
      })
      .returning({
        id: providerConnections.id
      });

    const insertedLocations = await db
      .insert(locations)
      .values([
        {
          organizationId,
          name: 'Never Synced',
          provider: 'google',
          externalId: 'locations/never-synced',
          providerConnectionId: healthyConnection.id
        },
        {
          organizationId,
          name: 'Stale Sync',
          provider: 'google',
          externalId: 'locations/stale',
          providerConnectionId: healthyConnection.id,
          lastSyncAttemptAt: staleAttempt
        },
        {
          organizationId,
          name: 'Recent Sync',
          provider: 'google',
          externalId: 'locations/recent',
          providerConnectionId: healthyConnection.id,
          lastSyncAttemptAt: recentAttempt
        },
        {
          organizationId,
          name: 'Needs Reauth',
          provider: 'google',
          externalId: 'locations/reauth',
          providerConnectionId: reauthConnection.id
        },
        {
          organizationId,
          name: 'Incomplete Provider',
          provider: 'google',
          providerConnectionId: healthyConnection.id
        }
      ])
      .returning({
        id: locations.id,
        name: locations.name
      });

    const byName = Object.fromEntries(
      insertedLocations.map((location) => [
        location.name,
        location.id
      ])
    );

    const firstRun = await enqueueDueProviderSyncs(db, now);

    assert.deepEqual(firstRun, {
      due: 2,
      enqueued: 2,
      deduplicated: 0
    });

    const queuedJobs = await db
      .select({
        locationId: jobs.payload
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.organizationId, organizationId),
          eq(jobs.type, 'sync-provider-reviews')
        )
      );

    const queuedLocationIds = queuedJobs
      .map((job) => {
        const payload = job.locationId as {
          locationId?: unknown;
        };

        return payload.locationId;
      })
      .filter(
        (value): value is number =>
          typeof value === 'number'
      )
      .sort((a, b) => a - b);

    assert.deepEqual(
      queuedLocationIds,
      [
        byName['Never Synced'],
        byName['Stale Sync']
      ].sort((a, b) => a - b)
    );

    const secondRun = await enqueueDueProviderSyncs(db, now);

    assert.deepEqual(secondRun, {
      due: 2,
      enqueued: 0,
      deduplicated: 2
    });

    const jobsAfterSecondRun = await db
      .select({
        id: jobs.id
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.organizationId, organizationId),
          eq(jobs.type, 'sync-provider-reviews')
        )
      );

    assert.equal(jobsAfterSecondRun.length, 2);
  } finally {
    if (organizationId !== undefined) {
      await db
        .delete(organizations)
        .where(eq(organizations.id, organizationId));
    }

    await client.end();
  }
});
