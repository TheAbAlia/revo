import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { providerConnections } from '@/lib/db/schema';
import {
  decryptCredential,
  encryptCredential,
} from '@/lib/integrations/crypto';

export type Provider = 'google';

type UpsertProviderConnectionInput = {
  organizationId: number;
  provider: Provider;
  externalAccountId: string;
  refreshToken: string;
};

export async function upsertProviderConnection({
  organizationId,
  provider,
  externalAccountId,
  refreshToken,
}: UpsertProviderConnectionInput) {
  const normalizedExternalAccountId = externalAccountId.trim();
  const normalizedRefreshToken = refreshToken.trim();

  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new Error('Invalid organization');
  }

  if (!normalizedExternalAccountId) {
    throw new Error('External account ID is required');
  }

  if (!normalizedRefreshToken) {
    throw new Error('Refresh token is required');
  }

  const refreshTokenEncrypted = encryptCredential(
    normalizedRefreshToken
  );

  const [connection] = await db
    .insert(providerConnections)
    .values({
      organizationId,
      provider,
      externalAccountId: normalizedExternalAccountId,
      refreshTokenEncrypted,
    })
    .onConflictDoUpdate({
      target: [
        providerConnections.organizationId,
        providerConnections.provider,
        providerConnections.externalAccountId,
      ],
      set: {
        refreshTokenEncrypted,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: providerConnections.id,
      organizationId: providerConnections.organizationId,
      provider: providerConnections.provider,
      externalAccountId: providerConnections.externalAccountId,
      createdAt: providerConnections.createdAt,
      updatedAt: providerConnections.updatedAt,
    });

  if (!connection) {
    throw new Error('Failed to persist provider connection');
  }

  return connection;
}

export async function getProviderConnectionCredential({
  organizationId,
  provider,
  externalAccountId,
}: {
  organizationId: number;
  provider: Provider;
  externalAccountId: string;
}) {
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new Error('Invalid organization');
  }

  const normalizedExternalAccountId = externalAccountId.trim();

  if (!normalizedExternalAccountId) {
    throw new Error('External account ID is required');
  }

  const [connection] = await db
    .select({
      id: providerConnections.id,
      organizationId: providerConnections.organizationId,
      provider: providerConnections.provider,
      externalAccountId: providerConnections.externalAccountId,
      refreshTokenEncrypted:
        providerConnections.refreshTokenEncrypted,
    })
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.organizationId, organizationId),
        eq(providerConnections.provider, provider),
        eq(
          providerConnections.externalAccountId,
          normalizedExternalAccountId
        )
      )
    )
    .limit(1);

  if (!connection) {
    return null;
  }

  return {
    id: connection.id,
    organizationId: connection.organizationId,
    provider: connection.provider as Provider,
    externalAccountId: connection.externalAccountId,
    refreshToken: decryptCredential(
      connection.refreshTokenEncrypted
    ),
  };
}
