import { and, desc, eq, sql } from 'drizzle-orm';

import {
  jobs,
  locations,
  responses,
  reviews
} from '@/lib/db/schema';
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

export async function retryReviewResponseGeneration(
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
    return {
      status: 'not-found' as const
    };
  }

  const [latestJob] = await db
    .select({
      status: jobs.status,
      payload: jobs.payload
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        eq(jobs.type, 'generate-ai-draft'),
        eq(
          sql`${jobs.payload}->>'reviewId'`,
          String(reviewId)
        )
      )
    )
    .orderBy(desc(jobs.createdAt))
    .limit(1);

  if (!latestJob || latestJob.status !== 'failed') {
    return {
      status: 'not-retryable' as const
    };
  }

  const force =
    typeof latestJob.payload === 'object' &&
    latestJob.payload !== null &&
    'force' in latestJob.payload &&
    latestJob.payload.force === true;

  const job = await enqueueJobWithDb(db, {
    organizationId,
    type: 'generate-ai-draft',
    dedupeKey:
      `generate-ai-draft:${organizationId}:${reviewId}`,
    payload: {
      reviewId,
      force
    }
  });

  return {
    status: 'queued' as const,
    jobId: job.id,
    created: job.created
  };
}

export async function saveReviewResponseDraft(
  db: ApiDb,
  organizationId: number,
  reviewId: number,
  content: string
) {
  const normalizedContent = content.trim();

  const [updatedResponse] = await db
    .update(responses)
    .set({
      content: normalizedContent,
      status: 'draft',
      approvedAt: null,
      publishedAt: null,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(responses.organizationId, organizationId),
        eq(responses.reviewId, reviewId)
      )
    )
    .returning({
      id: responses.id
    });

  if (!updatedResponse) {
    return {
      status: 'not-found' as const
    };
  }

  return {
    status: 'saved' as const
  };
}

export async function approveReviewResponse(
  db: ApiDb,
  organizationId: number,
  reviewId: number,
  content: string
) {
  const normalizedContent = content.trim();

  const [updatedResponse] = await db
    .update(responses)
    .set({
      content: normalizedContent,
      status: 'approved',
      approvedAt: new Date(),
      publishedAt: null,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(responses.organizationId, organizationId),
        eq(responses.reviewId, reviewId)
      )
    )
    .returning({
      id: responses.id
    });

  if (!updatedResponse) {
    return {
      status: 'not-found' as const
    };
  }

  return {
    status: 'approved' as const
  };
}

export async function publishReviewResponse(
  db: ApiDb,
  organizationId: number,
  reviewId: number
) {
  const [review] = await db
    .select({
      id: reviews.id,
      locationProvider: locations.provider,
      locationExternalId: locations.externalId,
      providerConnectionId:
        locations.providerConnectionId
    })
    .from(reviews)
    .innerJoin(
      locations,
      and(
        eq(locations.id, reviews.locationId),
        eq(
          locations.organizationId,
          organizationId
        )
      )
    )
    .where(
      and(
        eq(reviews.id, reviewId),
        eq(reviews.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!review) {
    return {
      status: 'not-found' as const
    };
  }

  if (
    review.locationProvider !== 'google' ||
    !review.locationExternalId ||
    !review.providerConnectionId
  ) {
    return {
      status: 'not-connected' as const
    };
  }

  const [response] = await db
    .select({
      id: responses.id,
      status: responses.status
    })
    .from(responses)
    .where(
      and(
        eq(responses.organizationId, organizationId),
        eq(responses.reviewId, reviewId)
      )
    )
    .limit(1);

  if (!response) {
    return {
      status: 'response-not-found' as const
    };
  }

  if (response.status !== 'approved') {
    return {
      status: 'not-approved' as const
    };
  }

  const job = await enqueueJobWithDb(db, {
    organizationId,
    type: 'publish-response',
    payload: {
      responseId: response.id
    },
    dedupeKey:
      `publish-response:${organizationId}:${response.id}`
  });

  return {
    status: 'queued' as const,
    jobId: job.id,
    created: job.created
  };
}
