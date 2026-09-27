import { sql } from 'drizzle-orm';
import type { createWorkerDb } from '@/lib/db/worker';
import { getJobLeaseTimeoutMs } from '@/lib/jobs/config';

export type ClaimedJob = {
  id: number;
  organizationId: number;
  type: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

const JOB_LEASE_TIMEOUT_MS = getJobLeaseTimeoutMs();

export async function claimNextJob(
  db: ReturnType<typeof createWorkerDb>['db'],
  workerId: string
): Promise<ClaimedJob | null> {
  await db.execute(sql`
    UPDATE jobs
    SET
      status = 'failed',
      dedupe_key = NULL,
      locked_at = NULL,
      locked_by = NULL,
      last_error = COALESCE(
        last_error,
        'Worker lock expired after final attempt'
      ),
      updated_at = NOW()
    WHERE status = 'processing'
      AND attempts >= max_attempts
      AND locked_at IS NOT NULL
      AND locked_at <= NOW() - (${JOB_LEASE_TIMEOUT_MS} * INTERVAL '1 millisecond')
  `);

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
    WHERE id = (
      SELECT id
      FROM jobs
      WHERE attempts < max_attempts
        AND (
          (
            status = 'pending'
            AND available_at <= NOW()
          )
          OR
          (
            status = 'processing'
            AND locked_at IS NOT NULL
            AND locked_at <= NOW() - (${JOB_LEASE_TIMEOUT_MS} * INTERVAL '1 millisecond')
          )
        )
      ORDER BY
        CASE
          WHEN status = 'pending' THEN 0
          ELSE 1
        END,
        available_at ASC,
        id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
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
    organizationId: row.organization_id,
    type: row.type,
    payload: row.payload,
    attempts: row.attempts,
    maxAttempts: row.max_attempts
  };
}
