import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  jobs,
  locations,
  responses,
  reviews,
} from '@/lib/db/schema';
import type { ReviewWithResponse } from '@/lib/domain/reviews';

export async function getReviewInbox(
  organizationId: number
): Promise<ReviewWithResponse[]> {
  const rows = await db
    .select({
      review: {
        id: reviews.id,
        organizationId: reviews.organizationId,
        locationId: reviews.locationId,
        provider: reviews.provider,
        externalId: reviews.externalId,
        authorName: reviews.authorName,
        authorInitials: reviews.authorInitials,
        rating: reviews.rating,
        content: reviews.content,
        receivedAt: reviews.receivedAt,
      },
      locationName: locations.name,
      locationProvider: locations.provider,
      locationExternalId: locations.externalId,
      providerConnectionId: locations.providerConnectionId,
      response: {
        id: responses.id,
        reviewId: responses.reviewId,
        organizationId: responses.organizationId,
        content: responses.content,
        status: responses.status,
        generatedByAI: responses.generatedByAI,
        createdAt: responses.createdAt,
        updatedAt: responses.updatedAt,
        approvedAt: responses.approvedAt,
        publishedAt: responses.publishedAt,
      },
    })
    .from(reviews)
    .innerJoin(
      locations,
      and(
        eq(reviews.locationId, locations.id),
        eq(locations.organizationId, organizationId)
      )
    )
    .leftJoin(
      responses,
      and(
        eq(reviews.id, responses.reviewId),
        eq(responses.organizationId, organizationId)
      )
    )
    .where(eq(reviews.organizationId, organizationId))
    .orderBy(desc(reviews.receivedAt));

  const generationJobs = await db
    .select({
      payload: jobs.payload,
      status: jobs.status,
      lastError: jobs.lastError,
      createdAt: jobs.createdAt
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        eq(jobs.type, 'generate-ai-draft')
      )
    )
    .orderBy(desc(jobs.createdAt));

  const latestGenerationJobByReviewId = new Map<
    number,
    {
      status: string;
      lastError: string | null;
    }
  >();

  for (const job of generationJobs) {
    const payload = job.payload;

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('reviewId' in payload) ||
      typeof payload.reviewId !== 'number'
    ) {
      continue;
    }

    if (!latestGenerationJobByReviewId.has(payload.reviewId)) {
      latestGenerationJobByReviewId.set(payload.reviewId, {
        status: job.status,
        lastError: job.lastError
      });
    }
  }

  return rows.map((row) => ({
    review: {
      id: String(row.review.id),
      organizationId: String(row.review.organizationId),
      locationId: String(row.review.locationId),
      provider: row.review.provider as 'google',
      externalId: row.review.externalId,
      authorName: row.review.authorName,
      authorInitials: row.review.authorInitials,
      rating: row.review.rating,
      content: row.review.content,
      receivedAt: row.review.receivedAt.toISOString(),
    },

    response: row.response?.id
      ? {
          id: String(row.response.id),
          reviewId: String(row.response.reviewId),
          organizationId: String(row.response.organizationId),
          content: row.response.content!,
          status: row.response.status as
            | 'draft'
            | 'approved'
            | 'published',
          generatedByAI: row.response.generatedByAI!,
          createdAt: row.response.createdAt!.toISOString(),
          updatedAt: row.response.updatedAt!.toISOString(),
          approvedAt:
            row.response.approvedAt?.toISOString() ?? null,
          publishedAt:
            row.response.publishedAt?.toISOString() ?? null,
        }
      : null,

    locationName: row.locationName,
    canPublish:
      row.locationProvider === 'google' &&
      Boolean(row.locationExternalId) &&
      Boolean(row.providerConnectionId),
    responseGenerationStatus: (() => {
      const job = latestGenerationJobByReviewId.get(row.review.id);

      if (!job) {
        return null;
      }

      if (job.status === 'pending') {
        return 'queued' as const;
      }

      if (job.status === 'processing') {
        return 'generating' as const;
      }

      if (job.status === 'failed') {
        return 'failed' as const;
      }

      return null;
    })(),
    responseGenerationError:
      latestGenerationJobByReviewId.get(row.review.id)?.lastError ?? null
  }));
}

export async function getUnansweredReviewCount(
  organizationId: number
): Promise<number> {
  const [result] = await db
    .select({
      count: count(reviews.id),
    })
    .from(reviews)
    .leftJoin(
      responses,
      and(
        eq(reviews.id, responses.reviewId),
        eq(responses.organizationId, organizationId)
      )
    )
    .where(
      and(
        eq(reviews.organizationId, organizationId),
        isNull(responses.id)
      )
    );

  return result?.count ?? 0;
}
