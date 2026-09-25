'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db/drizzle';
import { locations } from '@/lib/db/schema';
import { getOrganizationForUser } from '@/lib/db/queries';

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
