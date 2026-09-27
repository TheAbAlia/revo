import 'server-only';

import { buildReviewResponsePrompt } from '@/lib/ai/prompt';
import { generateWithGemini } from '@/lib/ai/providers/gemini';

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
  const prompt = buildReviewResponsePrompt(input);

  return generateWithGemini(prompt);
}
