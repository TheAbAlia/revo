import { and, eq } from 'drizzle-orm';

import type { DbExecutor } from '@/lib/db/types';
import { providerConnections } from '@/lib/db/schema';

export async function markProviderConnectionNeedsReauth(
  db: DbExecutor,
  organizationId: number,
  providerConnectionId: number,
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const [connection] = await db
    .update(providerConnections)
    .set({
      status: 'needs_reauth',
      lastError: message,
      lastErrorAt: new Date(),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(providerConnections.id, providerConnectionId),
        eq(providerConnections.organizationId, organizationId)
      )
    )
    .returning({
      id: providerConnections.id
    });

  if (!connection) {
    throw new Error('Provider connection not found');
  }
}

export async function markProviderConnectionHealthy(
  db: DbExecutor,
  organizationId: number,
  providerConnectionId: number
) {
  const [connection] = await db
    .update(providerConnections)
    .set({
      status: 'connected',
      lastError: null,
      lastErrorAt: null,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(providerConnections.id, providerConnectionId),
        eq(providerConnections.organizationId, organizationId)
      )
    )
    .returning({
      id: providerConnections.id
    });

  if (!connection) {
    throw new Error('Provider connection not found');
  }
}
