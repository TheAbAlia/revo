import {
  buildReviewResponsePrompt,
  REVIEW_RESPONSE_PROMPT_VERSION
} from '@/lib/ai/prompt';
import { generateWithGemini } from '@/lib/ai/providers/gemini';
import { validateGeneratedReviewResponse } from '@/lib/ai/validate-response';

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
  promptVersion: string;
};

export async function generateReviewResponse(
  input: ReviewResponseGenerationInput
): Promise<ReviewResponseGenerationResult> {
  const prompt = buildReviewResponsePrompt(input);

  const generation = await generateWithGemini({
    systemInstruction: prompt.systemInstruction,
    userContent: prompt.userContent
  });

  return {
    ...generation,
    content: validateGeneratedReviewResponse(generation.content),
    promptVersion: REVIEW_RESPONSE_PROMPT_VERSION
  };
}
