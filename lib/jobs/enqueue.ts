import 'server-only';

import { db } from '@/lib/db/drizzle';
import { jobs } from '@/lib/db/schema';
import type {
  JobPayload,
  JobType
} from '@/lib/jobs/types';

export type EnqueueJobInput<T extends JobType> = {
  organizationId: number;
  type: T;
  payload: JobPayload<T>;
  availableAt?: Date;
  maxAttempts?: number;
};

export async function enqueueJob<T extends JobType>(
  input: EnqueueJobInput<T>
) {
  const [job] = await db
    .insert(jobs)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      payload: input.payload,
      availableAt: input.availableAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 3
    })
    .returning({
      id: jobs.id,
      type: jobs.type,
      status: jobs.status,
      availableAt: jobs.availableAt
    });

  if (!job) {
    throw new Error('Could not enqueue job');
  }

  return job;
}
