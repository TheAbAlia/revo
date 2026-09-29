import { and, count, eq, sql } from 'drizzle-orm';

import type { ApiDb } from '@/server/api/db';
import {
  locations,
  providerConnections,
  responses,
  reviews
} from '@/lib/db/schema';

export async function getLocations(
  db: ApiDb,
  organizationId: number
) {
  const rows = await db
    .select({
      id: locations.id,
      name: locations.name,
      provider: locations.provider,
      externalId: locations.externalId,
      providerConnectionId:
        locations.providerConnectionId,
      providerConnectionStatus:
        providerConnections.status,
      lastSyncAttemptAt:
        locations.lastSyncAttemptAt,
      lastSyncedAt: locations.lastSyncedAt,
      lastSyncError: locations.lastSyncError,
      reviewCount: count(reviews.id),
      needsResponseCount: sql<number>`
        count(${reviews.id}) filter (
          where ${reviews.id} is not null
          and ${responses.id} is null
        )
      `,
      respondedCount: sql<number>`
        count(${responses.id})
      `
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
    .leftJoin(
      reviews,
      and(
        eq(reviews.locationId, locations.id),
        eq(
          reviews.organizationId,
          organizationId
        )
      )
    )
    .leftJoin(
      responses,
      and(
        eq(responses.reviewId, reviews.id),
        eq(
          responses.organizationId,
          organizationId
        )
      )
    )
    .where(
      eq(locations.organizationId, organizationId)
    )
    .groupBy(
      locations.id,
      locations.name,
      locations.provider,
      locations.externalId,
      locations.providerConnectionId,
      providerConnections.status,
      locations.createdAt
    )
    .orderBy(locations.createdAt);

  return rows.map((location) => ({
    ...location,
    reviewCount: Number(location.reviewCount),
    needsResponseCount: Number(
      location.needsResponseCount
    ),
    respondedCount: Number(
      location.respondedCount
    ),
    lastSyncAttemptAt:
      location.lastSyncAttemptAt?.toISOString() ??
      null,
    lastSyncedAt:
      location.lastSyncedAt?.toISOString() ?? null
  }));
}
