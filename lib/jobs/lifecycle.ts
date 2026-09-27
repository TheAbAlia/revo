import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { jobs } from '@/lib/db/schema';

export async function completeJob(
  jobId: number,
  workerId: string
) {
  const [job] = await db
    .update(jobs)
    .set({
      status: 'completed',
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
  jobId: number,
  workerId: string,
  error: unknown
): Promise<'pending' | 'failed'> {
  const [job] = await db
    .select({
      attempts: jobs.attempts,
      maxAttempts: jobs.maxAttempts
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.status, 'processing'),
        eq(jobs.lockedBy, workerId)
      )
    )
    .limit(1);

  if (!job) {
    throw new Error('Job is not owned by this worker');
  }

  const exhausted = job.attempts >= job.maxAttempts;
  const nextStatus = exhausted ? 'failed' : 'pending';

  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const retryDelayMs =
    Math.min(60_000, 1000 * 2 ** (job.attempts - 1));

  const [updatedJob] = await db
    .update(jobs)
    .set({
      status: nextStatus,
      availableAt: exhausted
        ? new Date()
        : new Date(Date.now() + retryDelayMs),
      lockedAt: null,
      lockedBy: null,
      lastError: message.slice(0, 2000),
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

  if (!updatedJob) {
    throw new Error('Job is not owned by this worker');
  }

  return nextStatus;
}
