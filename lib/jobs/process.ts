import type { ClaimedJob } from '@/lib/jobs/claim';
import { PermanentJobError } from '@/lib/jobs/errors';
import type { createWorkerDb } from '@/lib/db/worker';
import { generateDraftForReview } from '@/lib/reviews/generate-draft';
import { syncProviderReviews } from '@/lib/integrations/providers/sync-reviews';
import { publishProviderResponse } from '@/lib/integrations/providers/publish-response';

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
    throw new PermanentJobError('Invalid generate-ai-draft job payload');
  }

  return {
    reviewId: payload.reviewId
  };
}

type SyncProviderReviewsPayload = {
  locationId: number;
};

function parseSyncProviderReviewsPayload(
  payload: unknown
): SyncProviderReviewsPayload {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('locationId' in payload) ||
    typeof payload.locationId !== 'number' ||
    !Number.isInteger(payload.locationId) ||
    payload.locationId <= 0
  ) {
    throw new PermanentJobError('Invalid sync-provider-reviews job payload');
  }

  return {
    locationId: payload.locationId
  };
}

type PublishResponsePayload = {
  responseId: number;
};

function parsePublishResponsePayload(
  payload: unknown
): PublishResponsePayload {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('responseId' in payload) ||
    typeof payload.responseId !== 'number' ||
    !Number.isInteger(payload.responseId) ||
    payload.responseId <= 0
  ) {
    throw new PermanentJobError('Invalid publish-response job payload');
  }

  return {
    responseId: payload.responseId
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

    case 'sync-provider-reviews': {
      const payload = parseSyncProviderReviewsPayload(job.payload);

      await syncProviderReviews(
        db,
        job.organizationId,
        payload.locationId
      );

      return;
    }

    case 'publish-response': {
      const payload = parsePublishResponsePayload(job.payload);

      await publishProviderResponse(
        db,
        job.organizationId,
        payload.responseId
      );

      return;
    }

    default:
      throw new PermanentJobError(`Unsupported job type: ${job.type}`);
  }
}
