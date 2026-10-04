import { and, eq } from 'drizzle-orm';

import type { DbExecutor } from '@/lib/db/types';
import { providerConnections } from '@/lib/db/schema';
import { decryptCredential } from '@/lib/integrations/crypto';
import { publishGoogleReviewResponse } from '@/lib/integrations/google/publish-review-response';
import { refreshGoogleAccessToken } from '@/lib/integrations/google/oauth';
import { getProviderPublishContext } from '@/lib/integrations/providers/publish-context';
import { refreshGoogleProviderAccessToken } from '@/lib/integrations/providers/refresh-access-token';
import type { ReviewResponsePublisher } from '@/lib/integrations/providers/publishing';
import { publishResponse } from '@/lib/reviews/publish-response';

type PublishProviderResponseDependencies = {
  decryptCredential: typeof decryptCredential;
  refreshGoogleAccessToken: typeof refreshGoogleAccessToken;
  publishGoogleReviewResponse: typeof publishGoogleReviewResponse;
};

const defaultDependencies: PublishProviderResponseDependencies = {
  decryptCredential,
  refreshGoogleAccessToken,
  publishGoogleReviewResponse
};

async function getProviderRefreshToken(
  db: DbExecutor,
  organizationId: number,
  providerConnectionId: number,
  decrypt: typeof decryptCredential
) {
  const [connection] = await db
    .select({
      refreshTokenEncrypted:
        providerConnections.refreshTokenEncrypted
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

  return decrypt(connection.refreshTokenEncrypted);
}

export async function publishProviderResponse(
  db: DbExecutor,
  organizationId: number,
  responseId: number,
  dependencies: PublishProviderResponseDependencies =
    defaultDependencies
) {
  const context = await getProviderPublishContext(
    db,
    organizationId,
    responseId
  );

  switch (context.provider) {
    case 'google': {
      const refreshToken = await getProviderRefreshToken(
        db,
        organizationId,
        context.providerConnectionId,
        dependencies.decryptCredential
      );

      const { accessToken } =
        await refreshGoogleProviderAccessToken(
          db,
          organizationId,
          context.providerConnectionId,
          refreshToken,
          dependencies.refreshGoogleAccessToken
        );

      const publisher: ReviewResponsePublisher = async ({
        locationExternalId,
        reviewExternalId,
        content
      }) =>
        dependencies.publishGoogleReviewResponse({
          accessToken,
          accountId: context.externalAccountId,
          locationId: locationExternalId,
          reviewId: reviewExternalId,
          content
        });

      return publishResponse(
        db,
        organizationId,
        responseId,
        publisher
      );
    }

    default:
      throw new Error(
        `Unsupported review provider: ${context.provider}`
      );
  }
}
