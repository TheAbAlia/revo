import { and, eq } from 'drizzle-orm';

import { reviews } from '@/lib/db/schema';
import { enqueueJobWithDb } from '@/lib/jobs/enqueue-db';
import type { ApiDb } from '../db';

export async function generateReviewResponse(
  db: ApiDb,
  organizationId: number,
  reviewId: number
) {
  const [review] = await db
    .select({
      id: reviews.id
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.id, reviewId),
        eq(reviews.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!review) {
    return null;
  }

  const job = await enqueueJobWithDb(db, {
    organizationId,
    type: 'generate-ai-draft',
    dedupeKey:
      `generate-ai-draft:${organizationId}:${reviewId}`,
    payload: {
      reviewId,
      force: true
    }
  });

  return {
    jobId: job.id,
    created: job.created
  };
}
