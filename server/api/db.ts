import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

import * as schema from '@/lib/db/schema';

export function createApiDb() {
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      'POSTGRES_URL environment variable is not set'
    );
  }

  const client = postgres(process.env.POSTGRES_URL);

  return {
    client,
    db: drizzle(client, { schema })
  };
}

export type ApiDb =
  ReturnType<typeof createApiDb>['db'];

export type {
  AppTransaction as ApiTransaction,
  DbExecutor as TenantDb
} from '@/lib/db/types';

import type {
  AppTransaction as ApiTransaction
} from '@/lib/db/types';

export async function setTenantContext(
  tx: ApiTransaction,
  organizationId: number
) {
  if (
    !Number.isInteger(organizationId) ||
    organizationId <= 0
  ) {
    throw new Error('Invalid tenant organization ID');
  }

  await tx.execute(sql`
    select set_config(
      'revo.organization_id',
      ${String(organizationId)},
      true
    )
  `);
}

export async function withTenantContext<T>(
  db: ApiDb,
  organizationId: number,
  operation: (tx: ApiTransaction) => Promise<T>
) {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, organizationId);
    return operation(tx);
  });
}
