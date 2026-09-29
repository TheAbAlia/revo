'use server';

import { revalidatePath } from 'next/cache';
import {
  approveReviewResponse,
  generateReviewResponse,
  publishReviewResponse,
  retryReviewResponseGeneration,
  saveReviewResponseDraft
} from '@/lib/api/server';

export async function generateResponse(
  reviewId: string
) {
  const result = await generateReviewResponse(
    reviewId
  );

  if (result.success) {
    revalidatePath('/');
  }

  return result;
}

export async function retryResponseGeneration(
  reviewId: string
) {
  const result =
    await retryReviewResponseGeneration(reviewId);

  if (result.success) {
    revalidatePath('/');
  }

  return result;
}

export async function saveResponseDraft(
  reviewId: string,
  content: string
) {
  const result = await saveReviewResponseDraft(
    reviewId,
    content
  );

  if (result.success) {
    revalidatePath('/');
  }

  return result;
}

export async function approveResponse(
  reviewId: string,
  content: string
) {
  const result = await approveReviewResponse(
    reviewId,
    content
  );

  if (result.success) {
    revalidatePath('/');
  }

  return result;
}

export async function publishApprovedResponse(
  reviewId: string
) {
  const result = await publishReviewResponse(
    reviewId
  );

  if (result.success) {
    revalidatePath('/');
  }

  return result;
}
