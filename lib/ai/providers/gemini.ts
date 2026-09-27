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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
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
      cache: 'no-store'
    }
  );

  if (!response.ok) {
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
