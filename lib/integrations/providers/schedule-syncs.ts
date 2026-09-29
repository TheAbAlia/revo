import {
  and,
  eq,
  isNotNull,
  or,
  isNull,
  lte
} from 'drizzle-orm';

import type { createWorkerDb } from '@/lib/db/worker';
import {
  locations,
  providerConnections
} from '@/lib/db/schema';
import { enqueueJobWithDb } from '@/lib/jobs/enqueue-db';

export const PROVIDER_SYNC_INTERVAL_MS =
  15 * 60 * 1000;

export async function enqueueDueProviderSyncs(
  db: ReturnType<typeof createWorkerDb>['db'],
  now = new Date()
) {
  const dueBefore = new Date(
    now.getTime() - PROVIDER_SYNC_INTERVAL_MS
  );

  const dueLocations = await db
    .select({
      id: locations.id,
      organizationId: locations.organizationId
    })
    .from(locations)
    .innerJoin(
      providerConnections,
      and(
        eq(
          providerConnections.id,
          locations.providerConnectionId
        ),
        eq(
          providerConnections.organizationId,
          locations.organizationId
        )
      )
    )
    .where(
      and(
        isNotNull(locations.provider),
        isNotNull(locations.externalId),
        isNotNull(locations.providerConnectionId),
        eq(providerConnections.status, 'connected'),
        or(
          isNull(locations.lastSyncAttemptAt),
          lte(locations.lastSyncAttemptAt, dueBefore)
        )
      )
    );

  let enqueued = 0;

  for (const location of dueLocations) {
    const dedupeKey =
      `sync-provider-reviews:${location.organizationId}:${location.id}`;

    const job = await enqueueJobWithDb(db, {
      organizationId: location.organizationId,
      type: 'sync-provider-reviews',
      payload: {
        locationId: location.id
      },
      dedupeKey
    });

    if (job.created) {
      enqueued += 1;
    }
  }

  return {
    due: dueLocations.length,
    enqueued,
    deduplicated: dueLocations.length - enqueued
  };
}
