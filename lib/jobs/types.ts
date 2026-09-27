export type GenerateAIDraftJob = {
  type: 'generate-ai-draft';
  payload: {
    reviewId: number;
  };
};

export type JobDefinition =
  | GenerateAIDraftJob;

export type JobType = JobDefinition['type'];

export type JobPayload<T extends JobType> =
  Extract<JobDefinition, { type: T }>['payload'];
