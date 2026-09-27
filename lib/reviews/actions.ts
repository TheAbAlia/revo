'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/drizzle';
import {
  locations,
  responses,
  reviews
} from '@/lib/db/schema';
import { getOrganizationForUser } from '@/lib/db/queries';
import { enqueueJob } from '@/lib/jobs/enqueue';
import { getLatestGenerationJob } from '@/lib/jobs/queries';

async function getAuthorizedReview(reviewId: number) {
  const membership = await getOrganizationForUser();

  if (!membership) {
    throw new Error('Unauthorized');
  }

  const [review] = await db
    .select({
      id: reviews.id,
      organizationId: reviews.organizationId,
      rating: reviews.rating,
      content: reviews.content,
      authorName: reviews.authorName,
      locationName: locations.name,
      locationProvider: locations.provider,
      locationExternalId: locations.externalId,
      providerConnectionId: locations.providerConnectionId
    })
    .from(reviews)
    .innerJoin(
      locations,
      and(
        eq(locations.id, reviews.locationId),
        eq(
          locations.organizationId,
          membership.organization.id
        )
      )
    )
    .where(
      and(
        eq(reviews.id, reviewId),
        eq(
          reviews.organizationId,
          membership.organization.id
        )
      )
    )
    .limit(1);

  if (!review) {
    throw new Error('Review not found');
  }

  return {
    review,
    organizationId: membership.organization.id
  };
}

export async function generateResponse(reviewId: string) {
  const numericReviewId = Number(reviewId);

  if (!Number.isInteger(numericReviewId)) {
    throw new Error('Invalid review');
  }

  const { organizationId } =
    await getAuthorizedReview(numericReviewId);

  try {
    await enqueueJob({
      organizationId,
      type: 'generate-ai-draft',
      dedupeKey: `generate-ai-draft:${organizationId}:${numericReviewId}`,
      payload: {
        reviewId: numericReviewId,
        force: true
      }
    });

    revalidatePath('/');

    return {
      success: true as const
    };
  } catch (error) {
    console.error(
      'Review response generation enqueue failed',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return {
      success: false as const,
      error: 'Could not start response generation. Please try again.'
    };
  }
}

export async function retryResponseGeneration(
  reviewId: string
) {
  const numericReviewId = Number(reviewId);

  if (!Number.isInteger(numericReviewId)) {
    throw new Error('Invalid review');
  }

  const { organizationId } =
    await getAuthorizedReview(numericReviewId);

  const latestJob = await getLatestGenerationJob(
    organizationId,
    numericReviewId
  );

  if (!latestJob || latestJob.status !== 'failed') {
    return {
      success: false as const,
      error: 'There is no failed generation to retry.'
    };
  }

  try {
    await enqueueJob({
      organizationId,
      type: 'generate-ai-draft',
      dedupeKey: `generate-ai-draft:${organizationId}:${numericReviewId}`,
      payload: {
        reviewId: numericReviewId,
        force:
          typeof latestJob.payload === 'object' &&
          latestJob.payload !== null &&
          'force' in latestJob.payload &&
          latestJob.payload.force === true
      }
    });

    revalidatePath('/');

    return {
      success: true as const
    };
  } catch (error) {
    console.error(
      'Review response generation retry enqueue failed',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return {
      success: false as const,
      error: 'Could not retry response generation. Please try again.'
    };
  }
}

export async function saveResponseDraft(
  reviewId: string,
  content: string
) {
  const numericReviewId = Number(reviewId);

  if (!Number.isInteger(numericReviewId)) {
    throw new Error('Invalid review');
  }

  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error('Response cannot be empty');
  }

  const { organizationId } =
    await getAuthorizedReview(numericReviewId);

  const [existingResponse] = await db
    .select({ id: responses.id })
    .from(responses)
    .where(
      and(
        eq(responses.organizationId, organizationId),
        eq(responses.reviewId, numericReviewId)
      )
    )
    .limit(1);

  if (!existingResponse) {
    throw new Error('Response not found');
  }

  await db
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
        eq(responses.id, existingResponse.id),
        eq(responses.organizationId, organizationId)
      )
    );

  revalidatePath('/');
}

export async function approveResponse(
  reviewId: string,
  content: string
) {
  const numericReviewId = Number(reviewId);

  if (!Number.isInteger(numericReviewId)) {
    throw new Error('Invalid review');
  }

  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error('Response cannot be empty');
  }

  const { organizationId } =
    await getAuthorizedReview(numericReviewId);

  await db
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
        eq(responses.reviewId, numericReviewId)
      )
    );

  revalidatePath('/');
}

export async function publishApprovedResponse(
  reviewId: string
) {
  const numericReviewId = Number(reviewId);

  if (
    !Number.isInteger(numericReviewId) ||
    numericReviewId <= 0
  ) {
    throw new Error('Invalid review');
  }

  const { review, organizationId } =
    await getAuthorizedReview(numericReviewId);

  if (
    review.locationProvider !== 'google' ||
    !review.locationExternalId ||
    !review.providerConnectionId
  ) {
    throw new Error('Location is not connected to Google');
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
        eq(responses.reviewId, numericReviewId)
      )
    )
    .limit(1);

  if (!response) {
    throw new Error('Response not found');
  }

  if (response.status !== 'approved') {
    throw new Error('Response is not approved');
  }

  await enqueueJob({
    organizationId,
    type: 'publish-response',
    payload: {
      responseId: response.id
    },
    dedupeKey:
      `publish-response:${organizationId}:${response.id}`
  });

  revalidatePath('/');

  return {
    success: true as const
  };
}
