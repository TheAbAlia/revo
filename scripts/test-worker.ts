import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { createWorkerDb } from '@/lib/db/worker';
import {
  automationSettings,
  jobs
} from '@/lib/db/schema';
import { getJobLeaseTimeoutMs } from '@/lib/jobs/config';
import { failJob } from '@/lib/jobs/lifecycle';
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

test('worker permanently fails an invalid job payload', async () => {
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
        availableAt: jobs.availableAt,
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

test('worker reclaims a stale processing job', async () => {
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    const staleLockedAt = new Date(
      Date.now() - getJobLeaseTimeoutMs() - 5000
    );

    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId: 2,
        type: 'generate-ai-draft',
        payload: {
          reviewId: 18
        },
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        availableAt: new Date(),
        lockedAt: staleLockedAt,
        lockedBy: 'dead-integration-test-worker'
      })
      .returning({
        id: jobs.id
      });

    assert.ok(job);
    testJobId = job.id;

    const result = await runNextJob(
      workerDb.db,
      'replacement-integration-test-worker'
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
    assert.equal(storedJob.attempts, 2);
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

test('worker fails a stale job that exhausted its attempts', async () => {
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    const staleLockedAt = new Date(
      Date.now() - getJobLeaseTimeoutMs() - 5000
    );

    const dedupeKey =
      `integration-test-stale-exhausted-${Date.now()}`;

    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId: 2,
        type: 'generate-ai-draft',
        payload: {
          reviewId: 18
        },
        dedupeKey,
        status: 'processing',
        attempts: 3,
        maxAttempts: 3,
        availableAt: new Date(),
        lockedAt: staleLockedAt,
        lockedBy: 'dead-integration-test-worker'
      })
      .returning({
        id: jobs.id
      });

    assert.ok(job);
    testJobId = job.id;

    const result = await runNextJob(
      workerDb.db,
      'replacement-integration-test-worker'
    );

    assert.equal(result.status, 'idle');

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
    assert.equal(storedJob.attempts, 3);
    assert.equal(storedJob.dedupeKey, null);
    assert.equal(storedJob.lockedAt, null);
    assert.equal(storedJob.lockedBy, null);
    assert.equal(
      storedJob.lastError,
      'Worker lock expired after final attempt'
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

test('worker permanently fails an invalid publish-response job', async () => {
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId: 2,
        type: 'publish-response',
        payload: {},
        availableAt: new Date(),
        maxAttempts: 3
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
      'Invalid publish-response job payload'
    );

    const [storedJob] = await workerDb.db
      .select({
        status: jobs.status,
        attempts: jobs.attempts,
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
    assert.equal(storedJob.lockedAt, null);
    assert.equal(storedJob.lockedBy, null);
    assert.equal(
      storedJob.lastError,
      'Invalid publish-response job payload'
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

test('ordinary job errors remain retryable with backoff', async () => {
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
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        availableAt: new Date(),
        lockedAt: new Date(),
        lockedBy: 'retryable-error-test-worker'
      })
      .returning({
        id: jobs.id
      });

    assert.ok(job);
    testJobId = job.id;

    const beforeFailure = new Date();

    const status = await failJob(
      workerDb.db,
      job.id,
      'retryable-error-test-worker',
      new Error('Temporary provider failure')
    );

    assert.equal(status, 'pending');

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
      'Temporary provider failure'
    );
    assert.ok(storedJob.availableAt > beforeFailure);
  } finally {
    if (testJobId !== null) {
      await workerDb.db
        .delete(jobs)
        .where(eq(jobs.id, testJobId));
    }

    await workerDb.client.end();
  }
});

test('worker permanently rejects invalid generation force value', async () => {
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId: 2,
        type: 'generate-ai-draft',
        payload: {
          reviewId: 18,
          force: 'yes'
        },
        availableAt: new Date(),
        maxAttempts: 3
      })
      .returning({
        id: jobs.id
      });

    assert.ok(job);
    testJobId = job.id;

    const result = await runNextJob(
      workerDb.db,
      'invalid-force-test-worker'
    );

    assert.equal(result.status, 'failed');
    assert.equal(
      result.error,
      'Invalid generate-ai-draft job payload'
    );

    const [storedJob] = await workerDb.db
      .select({
        status: jobs.status,
        attempts: jobs.attempts,
        lastError: jobs.lastError
      })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1);

    assert.equal(storedJob?.status, 'failed');
    assert.equal(storedJob?.attempts, 1);
    assert.equal(
      storedJob?.lastError,
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

test('automatic generation job is skipped when automation is disabled', async () => {
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    await workerDb.db
      .insert(automationSettings)
      .values({
        organizationId: 2,
        autoGenerateDrafts: false
      })
      .onConflictDoUpdate({
        target: automationSettings.organizationId,
        set: {
          autoGenerateDrafts: false,
          updatedAt: new Date()
        }
      });

    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId: 2,
        type: 'generate-ai-draft',
        payload: {
          reviewId: 18,
          automatic: true
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
      'automatic-disabled-test-worker'
    );

    assert.equal(result.status, 'completed');
    assert.equal(result.jobId, job.id);

    const [storedJob] = await workerDb.db
      .select({
        status: jobs.status,
        attempts: jobs.attempts,
        lastError: jobs.lastError
      })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1);

    assert.equal(storedJob?.status, 'completed');
    assert.equal(storedJob?.attempts, 1);
    assert.equal(storedJob?.lastError, null);
  } finally {
    if (testJobId !== null) {
      await workerDb.db
        .delete(jobs)
        .where(eq(jobs.id, testJobId));
    }

    await workerDb.db
      .insert(automationSettings)
      .values({
        organizationId: 2,
        autoGenerateDrafts: true
      })
      .onConflictDoUpdate({
        target: automationSettings.organizationId,
        set: {
          autoGenerateDrafts: true,
          updatedAt: new Date()
        }
      });

    await workerDb.client.end();
  }
});

test('worker permanently rejects invalid automatic generation value', async () => {
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    const [job] = await workerDb.db
      .insert(jobs)
      .values({
        organizationId: 2,
        type: 'generate-ai-draft',
        payload: {
          reviewId: 18,
          automatic: 'yes'
        },
        availableAt: new Date(),
        maxAttempts: 3
      })
      .returning({
        id: jobs.id
      });

    assert.ok(job);
    testJobId = job.id;

    const result = await runNextJob(
      workerDb.db,
      'invalid-automatic-test-worker'
    );

    assert.equal(result.status, 'failed');
    assert.equal(
      result.error,
      'Invalid generate-ai-draft job payload'
    );

    const [storedJob] = await workerDb.db
      .select({
        status: jobs.status,
        attempts: jobs.attempts,
        lastError: jobs.lastError
      })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1);

    assert.equal(storedJob?.status, 'failed');
    assert.equal(storedJob?.attempts, 1);
    assert.equal(
      storedJob?.lastError,
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
