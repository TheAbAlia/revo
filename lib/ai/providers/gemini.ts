import 'server-only';

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export type GeminiGenerationResult = {
  content: string;
  provider: 'gemini';
  model: string;
};

const TRANSIENT_STATUS_CODES = new Set([429, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 750;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateWithGemini(
  prompt: string
): Promise<GeminiGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim();

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!model) {
    throw new Error('GEMINI_MODEL is not configured');
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ]
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
    } catch {
      if (attempt === 0) {
        await wait(RETRY_DELAY_MS);
        continue;
      }

      throw new Error('Gemini generation request failed');
    }

    if (!response.ok) {
      const retryable = TRANSIENT_STATUS_CODES.has(response.status);

      if (retryable && attempt === 0) {
        await wait(RETRY_DELAY_MS);
        continue;
      }

      throw new Error(
        `Gemini generation failed (${response.status})`
      );
    }

    const data = (await response.json()) as GeminiResponse;

    const content = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!content) {
      throw new Error('Gemini returned no generated content');
    }

    return {
      content,
      provider: 'gemini',
      model
    };
  }

  throw new Error('Gemini generation failed');
}
