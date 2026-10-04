import {
  and,
  count,
  eq,
  isNull,
  sql
} from 'drizzle-orm';

import {
  locations,
  responses,
  reviews
} from '@/lib/db/schema';
import type { TenantDb } from '../db';

export async function getAnalyticsOverview(
  db: TenantDb,
  organizationId: number
) {
  const [summary] = await db
    .select({
      totalReviews: count(reviews.id),
      averageRating: sql<number>`
        coalesce(avg(${reviews.rating}), 0)
      `,
      respondedReviews: sql<number>`
        count(${responses.id})
      `
    })
    .from(reviews)
    .leftJoin(
      responses,
      and(
        eq(responses.reviewId, reviews.id),
        eq(responses.organizationId, organizationId)
      )
    )
    .where(eq(reviews.organizationId, organizationId));

  const [needsResponse] = await db
    .select({
      count: count(reviews.id)
    })
    .from(reviews)
    .leftJoin(
      responses,
      and(
        eq(responses.reviewId, reviews.id),
        eq(responses.organizationId, organizationId)
      )
    )
    .where(
      and(
        eq(reviews.organizationId, organizationId),
        isNull(responses.id)
      )
    );

  const ratingDistribution = await db
    .select({
      rating: reviews.rating,
      count: count(reviews.id)
    })
    .from(reviews)
    .where(eq(reviews.organizationId, organizationId))
    .groupBy(reviews.rating)
    .orderBy(reviews.rating);

  const locationBreakdown = await db
    .select({
      id: locations.id,
      name: locations.name,
      totalReviews: count(reviews.id),
      averageRating: sql<number>`
        coalesce(avg(${reviews.rating}), 0)
      `,
      respondedReviews: sql<number>`
        count(${responses.id})
      `
    })
    .from(locations)
    .leftJoin(
      reviews,
      and(
        eq(reviews.locationId, locations.id),
        eq(reviews.organizationId, organizationId)
      )
    )
    .leftJoin(
      responses,
      and(
        eq(responses.reviewId, reviews.id),
        eq(responses.organizationId, organizationId)
      )
    )
    .where(eq(locations.organizationId, organizationId))
    .groupBy(locations.id, locations.name)
    .orderBy(locations.name);

  const totalReviews = Number(summary?.totalReviews ?? 0);
  const respondedReviews = Number(
    summary?.respondedReviews ?? 0
  );

  return {
    totalReviews,
    averageRating: Number(summary?.averageRating ?? 0),
    respondedReviews,
    needsResponse: Number(needsResponse?.count ?? 0),
    responseCoverage:
      totalReviews === 0
        ? 0
        : (respondedReviews / totalReviews) * 100,
    ratingDistribution: ratingDistribution.map((row) => ({
      rating: row.rating,
      count: Number(row.count)
    })),
    locations: locationBreakdown.map((row) => ({
      id: row.id,
      name: row.name,
      totalReviews: Number(row.totalReviews),
      averageRating: Number(row.averageRating),
      respondedReviews: Number(row.respondedReviews)
    }))
  };
}
