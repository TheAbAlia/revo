'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/drizzle';
import {
  aiResponseGenerations,
  responses,
  reviews
} from '@/lib/db/schema';
import { getOrganizationForUser } from '@/lib/db/queries';

const generatedResponse =
  'Thank you for taking the time to share your experience. We’re glad to hear our team was helpful and that everything went smoothly. We really appreciate your recommendation and look forward to welcoming you again.';

async function getAuthorizedReview(reviewId: number) {
  const membership = await getOrganizationForUser();

  if (!membership) {
    throw new Error('Unauthorized');
  }

  const [review] = await db
    .select({
      id: reviews.id,
      organizationId: reviews.organizationId
    })
    .from(reviews)
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

  await db.transaction(async (tx) => {
    await tx.insert(aiResponseGenerations).values({
      organizationId,
      reviewId: numericReviewId,
      content: generatedResponse,
      provider: 'mock',
      model: 'revo-development'
    });

    const [existingResponse] = await tx
      .select({ id: responses.id })
      .from(responses)
      .where(
        and(
          eq(responses.organizationId, organizationId),
          eq(responses.reviewId, numericReviewId)
        )
      )
      .limit(1);

    if (existingResponse) {
      await tx
        .update(responses)
        .set({
          content: generatedResponse,
          status: 'draft',
          generatedByAI: true,
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

      return;
    }

    await tx.insert(responses).values({
      organizationId,
      reviewId: numericReviewId,
      content: generatedResponse,
      status: 'draft',
      generatedByAI: true
    });
  });

  revalidatePath('/');
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
