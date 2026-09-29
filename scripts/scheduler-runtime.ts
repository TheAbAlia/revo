import { createWorkerDb } from '@/lib/db/worker';
import { enqueueDueProviderSyncs } from '@/lib/integrations/providers/schedule-syncs';

const SCHEDULER_TICK_MS = 60_000;

export async function runScheduler() {
  const { db, client } = createWorkerDb();

  console.log('[scheduler] started');

  let stopping = false;

  const stop = async () => {
    if (stopping) {
      return;
    }

    stopping = true;
    console.log('[scheduler] stopping');
    await client.end();
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    while (!stopping) {
      try {
        const result = await enqueueDueProviderSyncs(db);

        console.log(
          `[scheduler] provider syncs: ` +
          `${result.due} due, ` +
          `${result.enqueued} enqueued, ` +
          `${result.deduplicated} deduplicated`
        );
      } catch (error) {
        console.error(
          '[scheduler] provider sync scheduling failed',
          error
        );
      }

      if (!stopping) {
        await new Promise((resolve) =>
          setTimeout(resolve, SCHEDULER_TICK_MS)
        );
      }
    }
  } finally {
    await stop();
  }
}
