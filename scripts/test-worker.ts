import assert from 'node:assert/strict';
import test from 'node:test';

import { eq, sql } from 'drizzle-orm';

import { createTestDb } from '@/lib/db/test';
import { createWorkerDb } from '@/lib/db/worker';
import {
  automationSettings,
  jobs,
  locations,
  organizations
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
      'integration-test-worker',
      async () => {},
      async (db, workerId) => {
        const result = await db.execute<{
          id: number;
          organization_id: number;
          type: string;
          payload: unknown;
          attempts: number;
          max_attempts: number;
        }>(sql`
          UPDATE jobs
          SET
            status = 'processing',
            attempts = attempts + 1,
            locked_at = NOW(),
            locked_by = ${workerId},
            updated_at = NOW()
          WHERE id = ${job.id}
            AND status = 'pending'
            AND attempts < max_attempts
          RETURNING
            id,
            organization_id,
            type,
            payload,
            attempts,
            max_attempts
        `);

        const row = result[0];

        if (!row) {
          return null;
        }

        return {
          id: row.id,
          organizationId:
            row.organization_id,
          type: row.type,
          payload: row.payload,
          attempts: row.attempts,
          maxAttempts: row.max_attempts
        };
      }
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
  const testDb = createTestDb();
  const workerDb = createWorkerDb();
  let testJobId: number | null = null;

  try {
    await testDb.db
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

    await testDb.db
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
    await testDb.client.end();
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


test(
  'worker scopes job processing to its tenant',
  async () => {
    const testDb = createTestDb();
    const workerDb = createWorkerDb();

    let organizationAId: number | null = null;
    let organizationBId: number | null = null;
    let testJobId: number | null = null;

    try {
      const [organizationA] = await testDb.db
        .insert(organizations)
        .values({
          name: 'Worker RLS Organization A',
          slug:
            `worker-rls-a-${crypto.randomUUID()}`
        })
        .returning({
          id: organizations.id
        });

      const [organizationB] = await testDb.db
        .insert(organizations)
        .values({
          name: 'Worker RLS Organization B',
          slug:
            `worker-rls-b-${crypto.randomUUID()}`
        })
        .returning({
          id: organizations.id
        });

      assert.ok(organizationA);
      assert.ok(organizationB);

      organizationAId = organizationA.id;
      organizationBId = organizationB.id;

      const [locationA] = await testDb.db
        .insert(locations)
        .values({
          organizationId: organizationA.id,
          name: 'Worker RLS Location A'
        })
        .returning({
          id: locations.id
        });

      const [locationB] = await testDb.db
        .insert(locations)
        .values({
          organizationId: organizationB.id,
          name: 'Worker RLS Location B'
        })
        .returning({
          id: locations.id
        });

      assert.ok(locationA);
      assert.ok(locationB);

      const [job] = await workerDb.db
        .insert(jobs)
        .values({
          organizationId: organizationA.id,
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
        'tenant-isolation-test-worker',
        async (db) => {
          const visible = await db
            .select({
              id: locations.id,
              organizationId:
                locations.organizationId
            })
            .from(locations)
            .where(
              sql`${locations.id} in (
                ${locationA.id},
                ${locationB.id}
              )`
            );

          assert.equal(visible.length, 1);
          assert.equal(
            visible[0]?.id,
            locationA.id
          );
          assert.equal(
            visible[0]?.organizationId,
            organizationA.id
          );
        },
        async (db, workerId) => {
          const result = await db.execute<{
            id: number;
            organization_id: number;
            type: string;
            payload: unknown;
            attempts: number;
            max_attempts: number;
          }>(sql`
            UPDATE jobs
            SET
              status = 'processing',
              attempts = attempts + 1,
              locked_at = NOW(),
              locked_by = ${workerId},
              updated_at = NOW()
            WHERE id = ${job.id}
              AND status = 'pending'
              AND attempts < max_attempts
            RETURNING
              id,
              organization_id,
              type,
              payload,
              attempts,
              max_attempts
          `);

          const row = result[0];

          if (!row) {
            return null;
          }

          return {
            id: row.id,
            organizationId:
              row.organization_id,
            type: row.type,
            payload: row.payload,
            attempts: row.attempts,
            maxAttempts: row.max_attempts
          };
        }
      );

      assert.equal(result.status, 'completed');
      assert.equal(result.jobId, job.id);

      const [storedJob] = await workerDb.db
        .select({
          status: jobs.status,
          lockedAt: jobs.lockedAt,
          lockedBy: jobs.lockedBy
        })
        .from(jobs)
        .where(eq(jobs.id, job.id))
        .limit(1);

      assert.ok(storedJob);
      assert.equal(
        storedJob.status,
        'completed'
      );
      assert.equal(storedJob.lockedAt, null);
      assert.equal(storedJob.lockedBy, null);
    } finally {
      if (testJobId !== null) {
        await workerDb.db
          .delete(jobs)
          .where(eq(jobs.id, testJobId));
      }

      if (organizationAId !== null) {
        await testDb.db
          .delete(organizations)
          .where(
            eq(
              organizations.id,
              organizationAId
            )
          );
      }

      if (organizationBId !== null) {
        await testDb.db
          .delete(organizations)
          .where(
            eq(
              organizations.id,
              organizationBId
            )
          );
      }

      await workerDb.client.end();
      await testDb.client.end();
    }
  }
);
