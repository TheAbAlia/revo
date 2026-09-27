import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
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
  dedupeKey?: string;
  availableAt?: Date;
  maxAttempts?: number;
};

export async function enqueueJob<T extends JobType>(
  input: EnqueueJobInput<T>
) {
  if (input.dedupeKey) {
    const [existingJob] = await db
      .select({
        id: jobs.id,
        type: jobs.type,
        status: jobs.status,
        availableAt: jobs.availableAt
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.organizationId, input.organizationId),
          eq(jobs.dedupeKey, input.dedupeKey),
          inArray(jobs.status, ['pending', 'processing'])
        )
      )
      .limit(1);

    if (existingJob) {
      return existingJob;
    }
  }

  const [job] = await db
    .insert(jobs)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      payload: input.payload,
      dedupeKey: input.dedupeKey ?? null,
      availableAt: input.availableAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 3
    })
    .onConflictDoNothing({
      target: jobs.dedupeKey
    })
    .returning({
      id: jobs.id,
      type: jobs.type,
      status: jobs.status,
      availableAt: jobs.availableAt
    });

  if (job) {
    return job;
  }

  if (input.dedupeKey) {
    const [existingJob] = await db
      .select({
        id: jobs.id,
        type: jobs.type,
        status: jobs.status,
        availableAt: jobs.availableAt
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.organizationId, input.organizationId),
          eq(jobs.dedupeKey, input.dedupeKey),
          inArray(jobs.status, ['pending', 'processing'])
        )
      )
      .limit(1);

    if (existingJob) {
      return existingJob;
    }
  }

  throw new Error('Could not enqueue job');
}
