import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { client } from '@/lib/db/drizzle';
import { runNextJob } from '@/lib/jobs/run-next';

const IDLE_DELAY_MS = 1000;

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

  try {
    while (!shuttingDown) {
      const result = await runNextJob(workerId);

      if (result.status === 'idle') {
        await sleep(IDLE_DELAY_MS);
        continue;
      }

      if (result.status === 'completed') {
        console.log(`[worker] completed job ${result.jobId}`);
        continue;
      }

      console.error(
        `[worker] job ${result.jobId} ${result.status}: ${result.error}`
      );
    }
  } finally {
    await client.end();
    console.log('[worker] stopped');
  }
}
