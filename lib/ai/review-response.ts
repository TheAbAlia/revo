import 'server-only';

export type ReviewResponseGenerationInput = {
  rating: number;
  reviewContent: string;
  authorName: string;
  locationName: string;
  brandVoiceInstructions: string | null;
};

export type ReviewResponseGenerationResult = {
  content: string;
  provider: string;
  model: string;
};

export async function generateReviewResponse(
  input: ReviewResponseGenerationInput
): Promise<ReviewResponseGenerationResult> {
  const businessContext = input.locationName
    ? ` for ${input.locationName}`
    : '';

  const content =
    `Thank you ${input.authorName} for taking the time to share ` +
    `your experience${businessContext}. We really appreciate ` +
    `your feedback and hope to welcome you again.`;

  return {
    content,
    provider: 'mock',
    model: 'revo-development',
  };
}
