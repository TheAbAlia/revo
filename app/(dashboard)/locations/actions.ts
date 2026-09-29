'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  createLocation as createLocationViaApi,
  syncLocationReviews as syncLocationReviewsViaApi
} from '@/lib/api/server';

const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(160)
});

export async function createLocation(
  formData: FormData
) {
  const result = createLocationSchema.safeParse({
    name: formData.get('name')
  });

  if (!result.success) {
    throw new Error('Invalid location name');
  }

  const response = await createLocationViaApi(
    result.data.name
  );

  if (!response.success) {
    if (response.error === 'Unauthorized') {
      redirect('/sign-in');
    }

    throw new Error(response.error);
  }

  revalidatePath('/');
  revalidatePath('/locations');

  redirect('/locations');
}

export async function syncLocationReviews(
  formData: FormData
) {
  const locationId = Number(
    formData.get('locationId')
  );

  if (
    !Number.isInteger(locationId) ||
    locationId <= 0
  ) {
    throw new Error('Invalid location');
  }

  const response =
    await syncLocationReviewsViaApi(
      String(locationId)
    );

  if (!response.success) {
    if (response.error === 'Unauthorized') {
      throw new Error('Unauthorized');
    }

    throw new Error(response.error);
  }

  revalidatePath('/');
  revalidatePath('/locations');
}
