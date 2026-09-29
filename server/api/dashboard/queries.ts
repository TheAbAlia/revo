import {
  and,
  count,
  eq,
  isNull
} from 'drizzle-orm';

import {
  responses,
  reviews
} from '@/lib/db/schema';
import type { ApiDb } from '../db';

export async function getDashboardShell(
  db: ApiDb,
  organizationId: number
) {
  const [result] = await db
    .select({
      count: count(reviews.id)
    })
    .from(reviews)
    .leftJoin(
      responses,
      and(
        eq(reviews.id, responses.reviewId),
        eq(
          responses.organizationId,
          organizationId
        )
      )
    )
    .where(
      and(
        eq(
          reviews.organizationId,
          organizationId
        ),
        isNull(responses.id)
      )
    );

  return {
    inboxCount: result?.count ?? 0
  };
}
