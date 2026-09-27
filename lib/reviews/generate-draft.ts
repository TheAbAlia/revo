import { and, eq, isNull } from 'drizzle-orm';
import type { createWorkerDb } from '@/lib/db/worker';
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
import { PermanentJobError } from '@/lib/jobs/errors';

export function generateDraftForReview(
  db: ReturnType<typeof createWorkerDb>['db'],
  organizationId: number,
  reviewId: number
): Promise<ReviewResponseGenerationResult>;

export function generateDraftForReview(
  db: ReturnType<typeof createWorkerDb>['db'],
  organizationId: number,
  reviewId: number,
  options: {
    skipIfResponseExists?: boolean;
    replaceExistingResponse?: boolean;
  }
): Promise<ReviewResponseGenerationResult | null>;

export async function generateDraftForReview(
  db: ReturnType<typeof createWorkerDb>['db'],
  organizationId: number,
  reviewId: number,
  options?: {
    skipIfResponseExists?: boolean;
    replaceExistingResponse?: boolean;
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

  const [existingResponse] = await db
    .select({
      id: responses.id,
      publishedAt: responses.publishedAt
    })
    .from(responses)
    .where(
      and(
        eq(responses.organizationId, organizationId),
        eq(responses.reviewId, reviewId)
      )
    )
    .limit(1);

  if (
    options?.skipIfResponseExists &&
    existingResponse
  ) {
    return null;
  }

  if (
    options?.replaceExistingResponse &&
    existingResponse?.publishedAt
  ) {
    throw new PermanentJobError(
      'Published responses cannot be regenerated'
    );
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

    if (
      options?.replaceExistingResponse &&
      existingResponse
    ) {
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
            eq(
              responses.organizationId,
              organizationId
            ),
            isNull(responses.publishedAt)
          )
        );

      return;
    }

    await tx
      .insert(responses)
      .values({
        organizationId,
        reviewId,
        content: generation.content,
        status: 'draft',
        generatedByAI: true
      })
      .onConflictDoNothing({
        target: [
          responses.organizationId,
          responses.reviewId
        ]
      });
  });

  return generation;
}
