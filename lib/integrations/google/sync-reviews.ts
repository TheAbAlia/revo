import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { locations } from '@/lib/db/schema';
import {
  normalizeGoogleReview,
  type GoogleReview
} from '@/lib/integrations/google/reviews';
import { ingestReview } from '@/lib/reviews/ingest';

export type SyncGoogleLocationReviewsInput = {
  organizationId: number;
  locationId: number;
  reviews: GoogleReview[];
};

export type SyncGoogleLocationReviewsResult = {
  received: number;
  created: number;
  existing: number;
  draftsGenerated: number;
  failed: number;
};

export async function syncGoogleLocationReviews(
  input: SyncGoogleLocationReviewsInput
): Promise<SyncGoogleLocationReviewsResult> {
  const [location] = await db
    .select({
      id: locations.id,
      provider: locations.provider,
      externalId: locations.externalId
    })
    .from(locations)
    .where(
      and(
        eq(locations.id, input.locationId),
        eq(locations.organizationId, input.organizationId)
      )
    )
    .limit(1);

  if (!location) {
    throw new Error('Location not found');
  }

  if (location.provider !== 'google' || !location.externalId) {
    throw new Error('Location is not connected to Google');
  }

  const result: SyncGoogleLocationReviewsResult = {
    received: input.reviews.length,
    created: 0,
    existing: 0,
    draftsGenerated: 0,
    failed: 0
  };

  for (const googleReview of input.reviews) {
    try {
      const normalized = normalizeGoogleReview(googleReview);

      const ingestion = await ingestReview({
        organizationId: input.organizationId,
        locationId: location.id,
        ...normalized
      });

      if (ingestion.created) {
        result.created += 1;
      } else {
        result.existing += 1;
      }

      if (ingestion.draftGenerated) {
        result.draftsGenerated += 1;
      }
    } catch (error) {
      result.failed += 1;

      console.error(
        'Google review sync item failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  return result;
}
