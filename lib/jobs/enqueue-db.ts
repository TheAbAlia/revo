import { and, eq, inArray } from 'drizzle-orm';

import type { DbExecutor } from '@/lib/db/types';
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

type JobDb = DbExecutor;

export async function enqueueJobWithDb<T extends JobType>(
  db: JobDb,
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
          eq(jobs.dedupeKey, input.dedupeKey)
        )
      )
      .limit(1);

    if (
      existingJob &&
      ['pending', 'processing'].includes(
        existingJob.status
      )
    ) {
      return {
        ...existingJob,
        created: false
      };
    }

    if (existingJob?.status === 'failed') {
      const [retriedJob] = await db
        .update(jobs)
        .set({
          payload: input.payload,
          status: 'pending',
          attempts: 0,
          availableAt:
            input.availableAt ?? new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(jobs.id, existingJob.id),
            eq(
              jobs.organizationId,
              input.organizationId
            ),
            eq(jobs.status, 'failed')
          )
        )
        .returning({
          id: jobs.id,
          type: jobs.type,
          status: jobs.status,
          availableAt: jobs.availableAt
        });

      if (retriedJob) {
        return {
          ...retriedJob,
          created: false
        };
      }
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
    return {
      ...job,
      created: true
    };
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
      return {
        ...existingJob,
        created: false
      };
    }
  }

  throw new Error('Could not enqueue job');
}
