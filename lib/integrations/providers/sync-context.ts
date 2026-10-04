import { and, eq } from 'drizzle-orm';

import type { DbExecutor } from '@/lib/db/types';
import {
  locations,
  providerConnections
} from '@/lib/db/schema';
import type { Provider } from '@/lib/integrations/providers/types';

export async function getProviderSyncContext(
  db: DbExecutor,
  organizationId: number,
  locationId: number
) {
  const [context] = await db
    .select({
      locationId: locations.id,
      locationName: locations.name,
      locationProvider: locations.provider,
      locationExternalId: locations.externalId,
      providerConnectionId: providerConnections.id,
      connectionProvider: providerConnections.provider,
      externalAccountId: providerConnections.externalAccountId
    })
    .from(locations)
    .innerJoin(
      providerConnections,
      and(
        eq(
          providerConnections.id,
          locations.providerConnectionId
        ),
        eq(
          providerConnections.organizationId,
          locations.organizationId
        )
      )
    )
    .where(
      and(
        eq(locations.id, locationId),
        eq(locations.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!context) {
    throw new Error(
      'Location has no provider connection'
    );
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
    context.locationProvider !== context.connectionProvider
  ) {
    throw new Error(
      'Location provider does not match provider connection'
    );
  }

  return {
    locationId: context.locationId,
    locationName: context.locationName,
    provider: context.locationProvider as Provider,
    locationExternalId: context.locationExternalId,
    providerConnectionId: context.providerConnectionId,
    externalAccountId: context.externalAccountId
  };
}
