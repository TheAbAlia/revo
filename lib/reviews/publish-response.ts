import { and, eq } from 'drizzle-orm';
import type { createWorkerDb } from '@/lib/db/worker';
import {
  locations,
  responses,
  reviews
} from '@/lib/db/schema';
import type {
  Provider
} from '@/lib/integrations/providers/types';
import type {
  ReviewResponsePublisher
} from '@/lib/integrations/providers/publishing';

export type PublishResponseResult = {
  responseId: number;
  status: 'published';
  publishedAt: Date;
};

export async function publishResponse(
  db: ReturnType<typeof createWorkerDb>['db'],
  organizationId: number,
  responseId: number,
  publisher: ReviewResponsePublisher
): Promise<PublishResponseResult> {
  const [record] = await db
    .select({
      responseId: responses.id,
      responseStatus: responses.status,
      content: responses.content,
      provider: reviews.provider,
      reviewExternalId: reviews.externalId,
      locationExternalId: locations.externalId
    })
    .from(responses)
    .innerJoin(
      reviews,
      and(
        eq(reviews.id, responses.reviewId),
        eq(reviews.organizationId, organizationId)
      )
    )
    .innerJoin(
      locations,
      and(
        eq(locations.id, reviews.locationId),
        eq(locations.organizationId, organizationId)
      )
    )
    .where(
      and(
        eq(responses.organizationId, organizationId),
        eq(responses.id, responseId)
      )
    )
    .limit(1);

  if (!record) {
    throw new Error('Response not found');
  }

  if (record.responseStatus !== 'approved') {
    throw new Error('Response is not approved');
  }

  if (record.provider !== 'google') {
    throw new Error('Unsupported review provider');
  }

  if (!record.locationExternalId) {
    throw new Error('Location is not connected to provider');
  }

  await publisher({
    provider: record.provider as Provider,
    organizationId,
    locationExternalId: record.locationExternalId,
    reviewExternalId: record.reviewExternalId,
    content: record.content
  });

  const publishedAt = new Date();

  const [published] = await db
    .update(responses)
    .set({
      status: 'published',
      publishedAt,
      updatedAt: publishedAt
    })
    .where(
      and(
        eq(responses.id, record.responseId),
        eq(responses.organizationId, organizationId),
        eq(responses.status, 'approved')
      )
    )
    .returning({ id: responses.id });

  if (!published) {
    throw new Error('Response publication state changed');
  }

  return {
    responseId: published.id,
    status: 'published',
    publishedAt
  };
}
