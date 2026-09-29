import { claimNextJob } from '@/lib/jobs/claim';
import { isPermanentJobError } from '@/lib/jobs/errors';
import {
  completeJob,
  failJob
} from '@/lib/jobs/lifecycle';
import { processJob } from '@/lib/jobs/process';
import {
  JobLeaseLostError,
  startJobLease
} from '@/lib/jobs/lease';

export type RunNextJobResult =
  | {
      status: 'idle';
    }
  | {
      status: 'completed';
      jobId: number;
    }
  | {
      status: 'retrying' | 'failed';
      jobId: number;
      error: string;
    };

type JobProcessor = typeof processJob;
type JobClaimer = typeof claimNextJob;

export async function runNextJob(
  db: ReturnType<typeof import('@/lib/db/worker').createWorkerDb>['db'],
  workerId: string,
  processor: JobProcessor = processJob,
  claimer: JobClaimer = claimNextJob
): Promise<RunNextJobResult> {
  const job = await claimer(db, workerId);

  if (!job) {
    return {
      status: 'idle'
    };
  }

  const startedAt = Date.now();
  const lease = startJobLease(
    db,
    job.id,
    workerId
  );

  try {
    await processor(db, job);

    await lease.stop();

    const leaseError = lease.getError();

    if (leaseError) {
      throw leaseError;
    }

    await completeJob(db, job.id, workerId);

    const durationMs = Date.now() - startedAt;

    console.log(
      `[worker] job ${job.id} ${job.type} ` +
      `attempt ${job.attempts}/${job.maxAttempts} ` +
      `completed in ${durationMs}ms`
    );

    return {
      status: 'completed',
      jobId: job.id
    };
  } catch (error) {
    await lease.stop();

    if (error instanceof JobLeaseLostError) {
      throw error;
    }

    const leaseError = lease.getError();

    if (leaseError) {
      throw leaseError;
    }

    const jobStatus = await failJob(
      db,
      job.id,
      workerId,
      error,
      {
        retryable: !isPermanentJobError(error)
      }
    );

    const durationMs = Date.now() - startedAt;
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      `[worker] job ${job.id} ${job.type} ` +
      `attempt ${job.attempts}/${job.maxAttempts} ` +
      `${jobStatus} in ${durationMs}ms: ${errorMessage}`
    );

    return {
      status:
        jobStatus === 'failed'
          ? 'failed'
          : 'retrying',
      jobId: job.id,
      error: errorMessage
    };
  }
}
