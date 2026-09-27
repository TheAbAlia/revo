import { and, eq, sql } from 'drizzle-orm';
import type { createWorkerDb } from '@/lib/db/worker';
import { jobs } from '@/lib/db/schema';

export async function renewJobLock(
  db: ReturnType<typeof createWorkerDb>['db'],
  jobId: number,
  workerId: string
) {
  const [job] = await db
    .update(jobs)
    .set({
      lockedAt: sql`NOW()`,
      updatedAt: sql`NOW()`
    })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, 'processing'),
        eq(jobs.lockedBy, workerId)
      )
    )
    .returning({ id: jobs.id });

  if (!job) {
    throw new Error('Job is not owned by this worker');
  }
}

export async function completeJob(
  db: ReturnType<typeof createWorkerDb>['db'],
  jobId: number,
  workerId: string
) {
  const [job] = await db
    .update(jobs)
    .set({
      status: 'completed',
      dedupeKey: null,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, 'processing'),
        eq(jobs.lockedBy, workerId)
      )
    )
    .returning({ id: jobs.id });

  if (!job) {
    throw new Error('Job is not owned by this worker');
  }
}

export async function failJob(
  db: ReturnType<typeof createWorkerDb>['db'],
  jobId: number,
  workerId: string,
  error: unknown
): Promise<'pending' | 'failed'> {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const [job] = await db
    .update(jobs)
    .set({
      status: sql`
        CASE
          WHEN ${jobs.attempts} >= ${jobs.maxAttempts}
            THEN 'failed'
          ELSE 'pending'
        END
      `,
      dedupeKey: sql`
        CASE
          WHEN ${jobs.attempts} >= ${jobs.maxAttempts}
            THEN NULL
          ELSE ${jobs.dedupeKey}
        END
      `,
      availableAt: sql`
        CASE
          WHEN ${jobs.attempts} >= ${jobs.maxAttempts}
            THEN NOW()
          ELSE NOW() + (
            LEAST(
              60000,
              1000 * POWER(
                2,
                GREATEST(${jobs.attempts} - 1, 0)
              )
            ) * INTERVAL '1 millisecond'
          )
        END
      `,
      lockedAt: null,
      lockedBy: null,
      lastError: message.slice(0, 2000),
      updatedAt: sql`NOW()`
    })
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, 'processing'),
        eq(jobs.lockedBy, workerId)
      )
    )
    .returning({
      status: jobs.status
    });

  if (!job) {
    throw new Error('Job is not owned by this worker');
  }

  if (
    job.status !== 'pending' &&
    job.status !== 'failed'
  ) {
    throw new Error(
      `Unexpected failed job status: ${job.status}`
    );
  }

  return job.status;
}
