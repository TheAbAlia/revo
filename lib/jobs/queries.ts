import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { jobs } from '@/lib/db/schema';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type JobDetails = {
  id: number;
  organizationId: number;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getLatestGenerationJob(
  organizationId: number,
  reviewId: number
): Promise<JobDetails | null> {
  const generationJobs = await db
    .select({
      id: jobs.id,
      organizationId: jobs.organizationId,
      type: jobs.type,
      status: jobs.status,
      attempts: jobs.attempts,
      maxAttempts: jobs.maxAttempts,
      availableAt: jobs.availableAt,
      lockedAt: jobs.lockedAt,
      lockedBy: jobs.lockedBy,
      lastError: jobs.lastError,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        eq(jobs.type, 'generate-ai-draft'),
        eq(
          jobs.payload,
          { reviewId }
        )
      )
    )
    .orderBy(desc(jobs.createdAt))
    .limit(1);

  const job = generationJobs[0];

  if (!job) {
    return null;
  }

  return {
    ...job,
    status: job.status as JobStatus
  };
}

export async function getJob(
  organizationId: number,
  jobId: number
): Promise<JobDetails | null> {
  const [job] = await db
    .select({
      id: jobs.id,
      organizationId: jobs.organizationId,
      type: jobs.type,
      status: jobs.status,
      attempts: jobs.attempts,
      maxAttempts: jobs.maxAttempts,
      availableAt: jobs.availableAt,
      lockedAt: jobs.lockedAt,
      lockedBy: jobs.lockedBy,
      lastError: jobs.lastError,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.id, jobId),
        eq(jobs.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!job) {
    return null;
  }

  return {
    ...job,
    status: job.status as JobStatus
  };
}
