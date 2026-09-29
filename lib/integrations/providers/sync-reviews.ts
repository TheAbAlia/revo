import { and, eq } from 'drizzle-orm';

import type { createWorkerDb } from '@/lib/db/worker';
import { locations, providerConnections } from '@/lib/db/schema';
import { decryptCredential } from '@/lib/integrations/crypto';
import { fetchGoogleReviews } from '@/lib/integrations/google/fetch-reviews';
import { refreshGoogleProviderAccessToken } from '@/lib/integrations/providers/refresh-access-token';
import { syncGoogleLocationReviews } from '@/lib/integrations/google/sync-reviews';
import { getProviderSyncContext } from '@/lib/integrations/providers/sync-context';

async function getProviderRefreshToken(
  db: ReturnType<typeof createWorkerDb>['db'],
  organizationId: number,
  providerConnectionId: number
) {
  const [connection] = await db
    .select({
      refreshTokenEncrypted:
        providerConnections.refreshTokenEncrypted,
    })
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.id, providerConnectionId),
        eq(providerConnections.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!connection) {
    throw new Error('Provider connection not found');
  }

  return decryptCredential(connection.refreshTokenEncrypted);
}

export async function syncProviderReviews(
  db: ReturnType<typeof createWorkerDb>['db'],
  organizationId: number,
  locationId: number
) {
  const startedAt = new Date();

  await db
    .update(locations)
    .set({
      lastSyncAttemptAt: startedAt,
      updatedAt: startedAt
    })
    .where(
      and(
        eq(locations.id, locationId),
        eq(locations.organizationId, organizationId)
      )
    );

  try {
    const context = await getProviderSyncContext(
      db,
      organizationId,
      locationId
    );

    let result;

    switch (context.provider) {
      case 'google': {
        const refreshToken = await getProviderRefreshToken(
          db,
          organizationId,
          context.providerConnectionId
        );

        const { accessToken } =
          await refreshGoogleProviderAccessToken(
            db,
            organizationId,
            context.providerConnectionId,
            refreshToken
          );

        const reviews = await fetchGoogleReviews({
          accessToken,
          accountId: context.externalAccountId,
          locationId: context.locationExternalId
        });

        result = await syncGoogleLocationReviews(db, {
          organizationId,
          locationId,
          reviews
        });

        break;
      }

      default:
        throw new Error(
          `Unsupported review provider: ${context.provider}`
        );
    }

    const completedAt = new Date();

    await db
      .update(locations)
      .set({
        lastSyncedAt: completedAt,
        lastSyncError: null,
        updatedAt: completedAt
      })
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.organizationId, organizationId)
        )
      );

    return result;
  } catch (error) {
    const failedAt = new Date();

    await db
      .update(locations)
      .set({
        lastSyncError:
          error instanceof Error
            ? error.message
            : 'Unknown synchronization error',
        updatedAt: failedAt
      })
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.organizationId, organizationId)
        )
      );

    throw error;
  }
}
