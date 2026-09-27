import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { createWorkerDb } from '@/lib/db/worker';
import { jobs } from '@/lib/db/schema';
import { runNextJob } from '@/lib/jobs/run-next';

test('worker claims and completes a queued job', async () => {
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId: 2,
        type: 'generate-ai-draft',
        payload: {
          reviewId: 18
        },
        availableAt: new Date()
      })
      .returning({
        id: jobs.id
      });

    assert.ok(job);
    testJobId = job.id;

    const result = await runNextJob(
      workerDb.db,
      'integration-test-worker'
    );

    assert.equal(result.status, 'completed');
    assert.equal(result.jobId, job.id);

    const [storedJob] = await workerDb.db
      .select({
        status: jobs.status,
        attempts: jobs.attempts,
        lockedAt: jobs.lockedAt,
        lockedBy: jobs.lockedBy
      })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1);

    assert.ok(storedJob);
    assert.equal(storedJob.status, 'completed');
    assert.equal(storedJob.attempts, 1);
    assert.equal(storedJob.lockedAt, null);
    assert.equal(storedJob.lockedBy, null);
  } finally {
    if (testJobId !== null) {
      await workerDb.db
        .delete(jobs)
        .where(eq(jobs.id, testJobId));
    }

    await workerDb.client.end();
  }
});
