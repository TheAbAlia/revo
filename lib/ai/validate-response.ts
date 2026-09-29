import { PermanentJobError } from '@/lib/jobs/errors';

const MAX_REVIEW_RESPONSE_LENGTH = 1500;

export function validateGeneratedReviewResponse(
  content: string
): string {
  const normalized = content.trim();

  if (!normalized) {
    throw new PermanentJobError(
      'AI generated an empty review response'
    );
  }

  if (normalized.length > MAX_REVIEW_RESPONSE_LENGTH) {
    throw new PermanentJobError(
      'AI generated a review response that is too long'
    );
  }

  if (normalized.includes('```')) {
    throw new PermanentJobError(
      'AI generated an invalid formatted response'
    );
  }

  return normalized;
}
