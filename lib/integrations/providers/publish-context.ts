import { and, eq } from 'drizzle-orm';

import type { DbExecutor } from '@/lib/db/types';
import {
  locations,
  providerConnections,
  responses,
  reviews
} from '@/lib/db/schema';
import type { Provider } from '@/lib/integrations/providers/types';

export async function getProviderPublishContext(
  db: DbExecutor,
  organizationId: number,
  responseId: number
) {
  const [context] = await db
    .select({
      responseId: responses.id,
      responseStatus: responses.status,
      reviewId: reviews.id,
      reviewProvider: reviews.provider,
      reviewExternalId: reviews.externalId,
      locationId: locations.id,
      locationProvider: locations.provider,
      locationExternalId: locations.externalId,
      providerConnectionId: providerConnections.id,
      connectionProvider: providerConnections.provider,
      externalAccountId: providerConnections.externalAccountId
    })
    .from(responses)
    .innerJoin(
      reviews,
      and(
        eq(reviews.id, responses.reviewId),
        eq(reviews.organizationId, responses.organizationId)
      )
    )
    .innerJoin(
      locations,
      and(
        eq(locations.id, reviews.locationId),
        eq(locations.organizationId, responses.organizationId)
      )
    )
    .innerJoin(
      providerConnections,
      and(
        eq(
          providerConnections.id,
          locations.providerConnectionId
        ),
        eq(
          providerConnections.organizationId,
          responses.organizationId
        )
      )
    )
    .where(
      and(
        eq(responses.id, responseId),
        eq(responses.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!context) {
    throw new Error(
      'Response has no provider connection'
    );
  }

  if (context.responseStatus !== 'approved') {
    throw new Error('Response is not approved');
  }

  if (
    !context.locationProvider ||
    !context.locationExternalId
  ) {
    throw new Error(
      'Location is not connected to a provider'
    );
  }

  if (
    context.reviewProvider !== context.locationProvider ||
    context.locationProvider !== context.connectionProvider
  ) {
    throw new Error(
      'Review, location, and provider connection do not match'
    );
  }

  return {
    responseId: context.responseId,
    reviewId: context.reviewId,
    reviewExternalId: context.reviewExternalId,
    locationId: context.locationId,
    provider: context.locationProvider as Provider,
    locationExternalId: context.locationExternalId,
    providerConnectionId: context.providerConnectionId,
    externalAccountId: context.externalAccountId
  };
}
