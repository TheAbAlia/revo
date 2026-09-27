'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { locations, providerConnections } from '@/lib/db/schema';
import { getOrganizationForUser } from '@/lib/db/queries';
import { enqueueJob } from '@/lib/jobs/enqueue';

const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(160)
});

export async function createLocation(formData: FormData) {
  const membership = await getOrganizationForUser();

  if (!membership) {
    redirect('/sign-in');
  }

  const result = createLocationSchema.safeParse({
    name: formData.get('name')
  });

  if (!result.success) {
    throw new Error('Invalid location name');
  }

  await db.insert(locations).values({
    organizationId: membership.organization.id,
    name: result.data.name
  });

  revalidatePath('/');
  revalidatePath('/locations');

  redirect('/locations');
}

export async function syncLocationReviews(formData: FormData) {
  const membership = await getOrganizationForUser();

  if (!membership) {
    throw new Error('Unauthorized');
  }

  const locationId = Number(formData.get('locationId'));

  if (!Number.isInteger(locationId) || locationId <= 0) {
    throw new Error('Invalid location');
  }

  const organizationId = membership.organization.id;

  const [location] = await db
    .select({
      id: locations.id,
      provider: locations.provider,
      externalId: locations.externalId,
      providerConnectionId: locations.providerConnectionId,
      providerConnectionStatus: providerConnections.status
    })
    .from(locations)
    .leftJoin(
      providerConnections,
      and(
        eq(
          providerConnections.id,
          locations.providerConnectionId
        ),
        eq(
          providerConnections.organizationId,
          organizationId
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

  if (!location) {
    throw new Error('Location not found');
  }

  if (
    !location.provider ||
    !location.externalId ||
    !location.providerConnectionId
  ) {
    throw new Error('Location is not connected to a provider');
  }

  if (location.providerConnectionStatus !== 'connected') {
    throw new Error('Provider connection requires reauthorization');
  }

  await enqueueJob({
    organizationId,
    type: 'sync-provider-reviews',
    payload: {
      locationId: location.id
    },
    dedupeKey:
      `sync-provider-reviews:${organizationId}:${location.id}`
  });

  revalidatePath('/');
  revalidatePath('/locations');
}
