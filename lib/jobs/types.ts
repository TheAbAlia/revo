export type GenerateAIDraftJob = {
  type: 'generate-ai-draft';
  payload: {
    reviewId: number;
  };
};

export type SyncProviderReviewsJob = {
  type: 'sync-provider-reviews';
  payload: {
    locationId: number;
  };
};

export type JobDefinition =
  | GenerateAIDraftJob
  | SyncProviderReviewsJob;

export type JobType = JobDefinition['type'];

export type JobPayload<T extends JobType> =
  Extract<JobDefinition, { type: T }>['payload'];
