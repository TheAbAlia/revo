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

test('worker retries a failed job and releases its lock', async () => {
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId: 2,
        type: 'generate-ai-draft',
        payload: {},
        availableAt: new Date(),
        maxAttempts: 3
      })
      .returning({
        id: jobs.id
      });

    assert.ok(job);
    testJobId = job.id;

    const beforeRun = new Date();

    const result = await runNextJob(
      workerDb.db,
      'integration-test-worker'
    );

    assert.equal(result.status, 'retrying');
    assert.equal(result.jobId, job.id);
    assert.equal(
      result.error,
      'Invalid generate-ai-draft job payload'
    );

    const [storedJob] = await workerDb.db
      .select({
        status: jobs.status,
        attempts: jobs.attempts,
        availableAt: jobs.availableAt,
        lockedAt: jobs.lockedAt,
        lockedBy: jobs.lockedBy,
        lastError: jobs.lastError
      })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1);

    assert.ok(storedJob);
    assert.equal(storedJob.status, 'pending');
    assert.equal(storedJob.attempts, 1);
    assert.equal(storedJob.lockedAt, null);
    assert.equal(storedJob.lockedBy, null);
    assert.equal(
      storedJob.lastError,
      'Invalid generate-ai-draft job payload'
    );
    assert.ok(storedJob.availableAt > beforeRun);
  } finally {
    if (testJobId !== null) {
      await workerDb.db
        .delete(jobs)
        .where(eq(jobs.id, testJobId));
    }

    await workerDb.client.end();
  }
});

test('worker permanently fails an exhausted job', async () => {
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    const dedupeKey =
      `integration-test-exhausted-${Date.now()}`;

    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId: 2,
        type: 'generate-ai-draft',
        payload: {},
        dedupeKey,
        availableAt: new Date(),
        maxAttempts: 1
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

    assert.equal(result.status, 'failed');
    assert.equal(result.jobId, job.id);
    assert.equal(
      result.error,
      'Invalid generate-ai-draft job payload'
    );

    const [storedJob] = await workerDb.db
      .select({
        status: jobs.status,
        attempts: jobs.attempts,
        dedupeKey: jobs.dedupeKey,
        lockedAt: jobs.lockedAt,
        lockedBy: jobs.lockedBy,
        lastError: jobs.lastError
      })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1);

    assert.ok(storedJob);
    assert.equal(storedJob.status, 'failed');
    assert.equal(storedJob.attempts, 1);
    assert.equal(storedJob.dedupeKey, null);
    assert.equal(storedJob.lockedAt, null);
    assert.equal(storedJob.lockedBy, null);
    assert.equal(
      storedJob.lastError,
      'Invalid generate-ai-draft job payload'
    );
  } finally {
    if (testJobId !== null) {
      await workerDb.db
        .delete(jobs)
        .where(eq(jobs.id, testJobId));
    }

    await workerDb.client.end();
  }
});
