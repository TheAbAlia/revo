import type { createWorkerDb } from '@/lib/db/worker';
import { renewJobLock } from '@/lib/jobs/lifecycle';

const DEFAULT_HEARTBEAT_INTERVAL_MS = 120_000;

export class JobLeaseLostError extends Error {
  constructor(jobId: number, cause?: unknown) {
    super(`Lost lease for job ${jobId}`, {
      cause
    });

    this.name = 'JobLeaseLostError';
  }
}

function getHeartbeatIntervalMs() {
  const value = Number(
    process.env.WORKER_HEARTBEAT_INTERVAL_MS
  );

  if (!Number.isFinite(value) || value < 1000) {
    return DEFAULT_HEARTBEAT_INTERVAL_MS;
  }

  return Math.min(value, 300_000);
}

export function startJobLease(
  db: ReturnType<typeof createWorkerDb>['db'],
  jobId: number,
  workerId: string
) {
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
        getHeartbeatIntervalMs()
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
    getHeartbeatIntervalMs()
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
