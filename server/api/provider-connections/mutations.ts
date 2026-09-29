import { and, eq } from 'drizzle-orm';

import type { ApiDb } from '@/server/api/db';
import { providerConnections } from '@/lib/db/schema';
import { encryptCredential } from '@/lib/integrations/crypto';

export async function getGoogleProviderConnection(
  db: ApiDb,
  organizationId: number,
  connectionId: number
) {
  const [connection] = await db
    .select({
      id: providerConnections.id,
      externalAccountId:
        providerConnections.externalAccountId
    })
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.id, connectionId),
        eq(
          providerConnections.organizationId,
          organizationId
        ),
        eq(providerConnections.provider, 'google')
      )
    )
    .limit(1);

  return connection ?? null;
}

export async function upsertGoogleProviderConnection(
  db: ApiDb,
  organizationId: number,
  externalAccountId: string,
  refreshToken: string
) {
  const normalizedExternalAccountId =
    externalAccountId.trim();
  const normalizedRefreshToken =
    refreshToken.trim();

  if (!normalizedExternalAccountId) {
    throw new Error(
      'External account ID is required'
    );
  }

  if (!normalizedRefreshToken) {
    throw new Error('Refresh token is required');
  }

  const refreshTokenEncrypted =
    encryptCredential(normalizedRefreshToken);

  const [connection] = await db
    .insert(providerConnections)
    .values({
      organizationId,
      provider: 'google',
      externalAccountId:
        normalizedExternalAccountId,
      refreshTokenEncrypted
    })
    .onConflictDoUpdate({
      target: [
        providerConnections.organizationId,
        providerConnections.provider,
        providerConnections.externalAccountId
      ],
      set: {
        refreshTokenEncrypted,
        status: 'connected',
        lastError: null,
        lastErrorAt: null,
        updatedAt: new Date()
      }
    })
    .returning({
      id: providerConnections.id,
      externalAccountId:
        providerConnections.externalAccountId
    });

  if (!connection) {
    throw new Error(
      'Failed to persist provider connection'
    );
  }

  return connection;
}
