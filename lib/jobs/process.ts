import type { ClaimedJob } from '@/lib/jobs/claim';
import type { createWorkerDb } from '@/lib/db/worker';
import { generateDraftForReview } from '@/lib/reviews/generate-draft';

type GenerateAIDraftPayload = {
  reviewId: number;
};

function parseGenerateAIDraftPayload(
  payload: unknown
): GenerateAIDraftPayload {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('reviewId' in payload) ||
    typeof payload.reviewId !== 'number' ||
    !Number.isInteger(payload.reviewId) ||
    payload.reviewId <= 0
  ) {
    throw new Error('Invalid generate-ai-draft job payload');
  }

  return {
    reviewId: payload.reviewId
  };
}

export async function processJob(
  db: ReturnType<typeof createWorkerDb>['db'],
  job: ClaimedJob
) {
  switch (job.type) {
    case 'generate-ai-draft': {
      const payload = parseGenerateAIDraftPayload(job.payload);

      await generateDraftForReview(
        db,
        job.organizationId,
        payload.reviewId,
        {
          skipIfResponseExists: true
        }
      );

      return;
    }

    default:
      throw new Error(`Unsupported job type: ${job.type}`);
  }
}
