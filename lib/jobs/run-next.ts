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

  try {
    await processJob(db, job);
    await completeJob(db, job.id, workerId);

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

    return {
      status:
        jobStatus === 'failed'
          ? 'failed'
          : 'retrying',
      jobId: job.id,
      error:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}
