import { and, eq } from 'drizzle-orm';

import type { TenantDb } from '@/server/api/db';
import {
  locations,
  providerConnections
} from '@/lib/db/schema';
import { enqueueJobWithDb } from '@/lib/jobs/enqueue-db';

export async function createLocation(
  db: TenantDb,
  organizationId: number,
  name: string
) {
  const [location] = await db
    .insert(locations)
    .values({
      organizationId,
      name
    })
    .returning({
      id: locations.id,
      name: locations.name
    });

  return location;
}

export async function syncLocationReviews(
  db: TenantDb,
  organizationId: number,
  locationId: number
) {
  const [location] = await db
    .select({
      id: locations.id,
      provider: locations.provider,
      externalId: locations.externalId,
      providerConnectionId:
        locations.providerConnectionId,
      providerConnectionStatus:
        providerConnections.status
    })
    .from(locations)
    .leftJoin(
      providerConnections,
      and(
        eq(
          providerConnections.id,
          locations.providerConnectionId
        ),
        eq(
          providerConnections.organizationId,
          organizationId
        )
      )
    )
    .where(
      and(
        eq(locations.id, locationId),
        eq(
          locations.organizationId,
          organizationId
        )
      )
    )
    .limit(1);

  if (!location) {
    return {
      status: 'not-found' as const
    };
  }

  if (
    !location.provider ||
    !location.externalId ||
    !location.providerConnectionId
  ) {
    return {
      status: 'not-connected' as const
    };
  }

  if (
    location.providerConnectionStatus !==
    'connected'
  ) {
    return {
      status: 'needs-reauth' as const
    };
  }

  const job = await enqueueJobWithDb(db, {
    organizationId,
    type: 'sync-provider-reviews',
    payload: {
      locationId: location.id
    },
    dedupeKey:
      `sync-provider-reviews:${organizationId}:${location.id}`
  });

  return {
    status: 'queued' as const,
    jobId: job.id,
    created: job.created
  };
}
