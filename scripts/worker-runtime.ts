import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { createWorkerDb } from '@/lib/db/worker';
import { runNextJob } from '@/lib/jobs/run-next';

const DEFAULT_IDLE_DELAY_MS = 1000;
const DATABASE_ERROR_DELAY_MS = 5000;

function getIdleDelayMs() {
  const value = Number(process.env.WORKER_IDLE_DELAY_MS);

  if (!Number.isFinite(value) || value < 100) {
    return DEFAULT_IDLE_DELAY_MS;
  }

  return Math.min(value, 30_000);
}

const workerId =
  `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;

let shuttingDown = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestShutdown(signal: string) {
  if (shuttingDown) {
    return;
  }

  console.log(`[worker] received ${signal}, shutting down`);
  shuttingDown = true;
}

export async function runWorker() {
  process.on('SIGINT', () => requestShutdown('SIGINT'));
  process.on('SIGTERM', () => requestShutdown('SIGTERM'));

  console.log(`[worker] started ${workerId}`);

  let workerDb = createWorkerDb();

  try {
    while (!shuttingDown) {
      try {
        const result = await runNextJob(
          workerDb.db,
          workerId
        );

        if (result.status === 'idle') {
          await sleep(getIdleDelayMs());
          continue;
        }

        if (result.status === 'completed') {
          console.log(`[worker] completed job ${result.jobId}`);
          continue;
        }

        console.error(
          `[worker] job ${result.jobId} ${result.status}: ${result.error}`
        );
      } catch (error) {
        console.error(
          '[worker] infrastructure error',
          error instanceof Error ? error.message : String(error)
        );

        await workerDb.client.end();

        if (!shuttingDown) {
          await sleep(DATABASE_ERROR_DELAY_MS);

          workerDb = createWorkerDb();
        }
      }
    }
  } finally {
    await workerDb.client.end();
    console.log('[worker] stopped');
  }
}
