import 'server-only';

import { db } from '@/lib/db/drizzle';
import {
  enqueueJobWithDb,
  type EnqueueJobInput
} from '@/lib/jobs/enqueue-db';
import type { JobType } from '@/lib/jobs/types';

export async function enqueueJob<T extends JobType>(
  input: EnqueueJobInput<T>
) {
  return enqueueJobWithDb(db, input);
}
