'use server';

import { redirect } from 'next/navigation';

import {
  createBillingCheckout,
  createBillingPortal
} from '@/lib/api/server';

export async function checkoutAction(
  formData: FormData
) {
  const priceId = formData.get('priceId');

  if (
    typeof priceId !== 'string' ||
    !priceId.trim()
  ) {
    throw new Error('Invalid price');
  }

  const checkout = await createBillingCheckout(
    priceId.trim()
  );

  if (!checkout) {
    redirect(
      `/sign-up?redirect=checkout&priceId=${encodeURIComponent(
        priceId.trim()
      )}`
    );
  }

  redirect(checkout.url);
}

export async function customerPortalAction() {
  const portal = await createBillingPortal();

  if (!portal) {
    redirect('/pricing');
  }

  redirect(portal.url);
}
