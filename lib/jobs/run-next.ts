import { claimNextJob } from '@/lib/jobs/claim';
import {
  completeJob,
  failJob
} from '@/lib/jobs/lifecycle';
import { processJob } from '@/lib/jobs/process';

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

export async function runNextJob(
  db: ReturnType<typeof import('@/lib/db/worker').createWorkerDb>['db'],
  workerId: string
): Promise<RunNextJobResult> {
  const job = await claimNextJob(db, workerId);

  if (!job) {
    return {
      status: 'idle'
    };
  }

  const startedAt = Date.now();

  try {
    await processJob(db, job);
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
    const jobStatus = await failJob(
      db,
      job.id,
      workerId,
      error
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
