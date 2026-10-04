import { sql } from 'drizzle-orm';

import type { createWorkerDb } from '@/lib/db/worker';
import { enqueueJobWithDb } from '@/lib/jobs/enqueue-db';

export const PROVIDER_SYNC_INTERVAL_MS =
  15 * 60 * 1000;

type DueProviderSyncLocation = {
  organization_id: number;
  location_id: number;
};

export async function enqueueDueProviderSyncs(
  db: ReturnType<typeof createWorkerDb>['db'],
  now = new Date()
) {
  const dueBefore = new Date(
    now.getTime() - PROVIDER_SYNC_INTERVAL_MS
  );

  const dueBeforeTimestamp =
    dueBefore.toISOString().replace('Z', '');

  const dueLocations =
    await db.execute<DueProviderSyncLocation>(sql`
      SELECT
        organization_id,
        location_id
      FROM public.revo_due_provider_sync_locations(
        ${dueBeforeTimestamp}::timestamp without time zone
      )
    `);

  let enqueued = 0;

  for (const location of dueLocations) {
    const dedupeKey =
      `sync-provider-reviews:${location.organization_id}:${location.location_id}`;

    const job = await enqueueJobWithDb(db, {
      organizationId: location.organization_id,
      type: 'sync-provider-reviews',
      payload: {
        locationId: location.location_id
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
    deduplicated:
      dueLocations.length - enqueued
  };
}
