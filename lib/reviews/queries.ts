import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
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
      eq(reviews.locationId, locations.id)
    )
    .leftJoin(
      responses,
      eq(reviews.id, responses.reviewId)
    )
    .where(eq(reviews.organizationId, organizationId))
    .orderBy(desc(reviews.receivedAt));

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
  }));
}
