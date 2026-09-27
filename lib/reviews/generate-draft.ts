import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  aiResponseGenerations,
  brandVoices,
  locations,
  responses,
  reviews
} from '@/lib/db/schema';
import {
  generateReviewResponse,
  type ReviewResponseGenerationResult
} from '@/lib/ai/review-response';

export function generateDraftForReview(
  organizationId: number,
  reviewId: number
): Promise<ReviewResponseGenerationResult>;

export function generateDraftForReview(
  organizationId: number,
  reviewId: number,
  options: {
    skipIfResponseExists: true;
  }
): Promise<ReviewResponseGenerationResult | null>;

export async function generateDraftForReview(
  organizationId: number,
  reviewId: number,
  options?: {
    skipIfResponseExists?: boolean;
  }
): Promise<ReviewResponseGenerationResult | null> {
  const [review] = await db
    .select({
      id: reviews.id,
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
        eq(locations.organizationId, organizationId)
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
    throw new Error('Review not found');
  }

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

  if (options?.skipIfResponseExists) {
    const [existingResponse] = await db
      .select({ id: responses.id })
      .from(responses)
      .where(
        and(
          eq(responses.organizationId, organizationId),
          eq(responses.reviewId, reviewId)
        )
      )
      .limit(1);

    if (existingResponse) {
      return null;
    }
  }

  const generation = await generateReviewResponse({
    rating: review.rating,
    reviewContent: review.content,
    authorName: review.authorName,
    locationName: review.locationName,
    brandVoiceInstructions: brandVoice?.instructions ?? null
  });

  await db.transaction(async (tx) => {
    await tx.insert(aiResponseGenerations).values({
      organizationId,
      reviewId,
      content: generation.content,
      provider: generation.provider,
      model: generation.model
    });

    await tx
      .insert(responses)
      .values({
        organizationId,
        reviewId,
        content: generation.content,
        status: 'draft',
        generatedByAI: true
      })
      .onConflictDoUpdate({
        target: [
          responses.organizationId,
          responses.reviewId
        ],
        set: {
          content: generation.content,
          status: 'draft',
          generatedByAI: true,
          approvedAt: null,
          publishedAt: null,
          updatedAt: new Date()
        }
      });
  });

  return generation;
}
