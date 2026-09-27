import type { createWorkerDb } from '@/lib/db/worker';
import { getJobHeartbeatIntervalMs } from '@/lib/jobs/config';
import { renewJobLock } from '@/lib/jobs/lifecycle';

export class JobLeaseLostError extends Error {
  constructor(jobId: number, cause?: unknown) {
    super(`Lost lease for job ${jobId}`, {
      cause
    });

    this.name = 'JobLeaseLostError';
  }
}

export function startJobLease(
  db: ReturnType<typeof createWorkerDb>['db'],
  jobId: number,
  workerId: string
) {
  const heartbeatIntervalMs =
    getJobHeartbeatIntervalMs();

  let stopped = false;
  let heartbeatError: JobLeaseLostError | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let heartbeatPromise: Promise<void> | null = null;

  async function heartbeat() {
    if (stopped) {
      return;
    }

    try {
      await renewJobLock(db, jobId, workerId);
    } catch (error) {
      heartbeatError = new JobLeaseLostError(
        jobId,
        error
      );
      stopped = true;
      return;
    }

    if (!stopped) {
      timeout = setTimeout(
        runHeartbeat,
        heartbeatIntervalMs
      );
    }
  }

  function runHeartbeat() {
    heartbeatPromise = heartbeat().finally(() => {
      heartbeatPromise = null;
    });
  }

  timeout = setTimeout(
    runHeartbeat,
    getJobHeartbeatIntervalMs()
  );

  return {
    getError() {
      return heartbeatError;
    },

    async stop() {
      stopped = true;

      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }

      if (heartbeatPromise) {
        await heartbeatPromise;
      }
    }
  };
}
