import 'server-only';

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
  workerId: string
): Promise<RunNextJobResult> {
  const job = await claimNextJob(workerId);

  if (!job) {
    return {
      status: 'idle'
    };
  }

  try {
    await processJob(job);
    await completeJob(job.id, workerId);

    return {
      status: 'completed',
      jobId: job.id
    };
  } catch (error) {
    const jobStatus = await failJob(
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
