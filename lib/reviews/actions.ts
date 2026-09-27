'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/drizzle';
import {
  aiResponseGenerations,
  brandVoices,
  locations,
  responses,
  reviews
} from '@/lib/db/schema';
import { getOrganizationForUser } from '@/lib/db/queries';
import { generateReviewResponse } from '@/lib/ai/review-response';

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
      locationName: locations.name
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

  const { review, organizationId } =
    await getAuthorizedReview(numericReviewId);

  const [brandVoice] = await db
    .select({
      instructions: brandVoices.instructions
    })
    .from(brandVoices)
    .where(
      and(
        eq(brandVoices.organizationId, organizationId),
        eq(brandVoices.isDefault, true)
      )
    )
    .limit(1);

  let generation;

  try {
    generation = await generateReviewResponse({
      rating: review.rating,
      reviewContent: review.content,
      authorName: review.authorName,
      locationName: review.locationName,
      brandVoiceInstructions: brandVoice?.instructions ?? null
    });
  } catch (error) {
    console.error(
      'Review response generation failed',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return {
      success: false as const,
      error: 'Could not generate a response. Please try again.'
    };
  }

  await db.transaction(async (tx) => {
    await tx.insert(aiResponseGenerations).values({
      organizationId,
      reviewId: numericReviewId,
      content: generation.content,
      provider: generation.provider,
      model: generation.model
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
          content: generation.content,
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
      content: generation.content,
      status: 'draft',
      generatedByAI: true
    });
  });

  revalidatePath('/');

  return {
    success: true as const,
    content: generation.content
  };
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
