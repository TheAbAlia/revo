import 'server-only';

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export type ClaimedJob = {
  id: number;
  organizationId: number;
  type: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

const STALE_LOCK_MINUTES = 10;

export async function claimNextJob(
  workerId: string
): Promise<ClaimedJob | null> {
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
            AND locked_at <= NOW() - (${STALE_LOCK_MINUTES} * INTERVAL '1 minute')
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
