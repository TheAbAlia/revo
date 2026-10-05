import Stripe from 'stripe';

import type { TenantDb } from '@/server/api/db';

import {
  getOrganizationBilling
} from './queries';
import {
  upsertOrganizationBilling
} from './mutations';

function getSubscriptionOrganizationId(
  subscription: Stripe.Subscription
) {
  const raw =
    subscription.metadata.organizationId;

  if (!raw) {
    return null;
  }

  const organizationId = Number(raw);

  if (
    !Number.isInteger(organizationId) ||
    organizationId <= 0
  ) {
    return null;
  }

  return organizationId;
}

function getSubscriptionCustomerId(
  subscription: Stripe.Subscription
) {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
}

function getSubscriptionProductId(
  subscription: Stripe.Subscription
) {
  const product =
    subscription.items.data[0]?.price.product;

  if (!product) {
    return null;
  }

  return typeof product === 'string'
    ? product
    : product.id;
}

export async function applySubscriptionWebhook(
  db: TenantDb,
  organizationId: number,
  subscription: Stripe.Subscription,
  productName: string | null
) {
  const metadataOrganizationId =
    getSubscriptionOrganizationId(subscription);

  if (
    metadataOrganizationId === null ||
    metadataOrganizationId !== organizationId
  ) {
    throw new Error(
      'Stripe subscription organization mismatch'
    );
  }

  const customerId =
    getSubscriptionCustomerId(subscription);

  const existing =
    await getOrganizationBilling(
      db,
      organizationId
    );

  if (
    existing?.stripeCustomerId &&
    existing.stripeCustomerId !== customerId
  ) {
    throw new Error(
      'Stripe customer does not match organization billing'
    );
  }

  const productId =
    getSubscriptionProductId(subscription);

  const inactive =
    subscription.status === 'canceled' ||
    subscription.status === 'unpaid';

  return upsertOrganizationBilling(
    db,
    organizationId,
    {
      stripeCustomerId: customerId,
      stripeSubscriptionId: inactive
        ? null
        : subscription.id,
      stripeProductId: inactive
        ? null
        : productId,
      planName: inactive
        ? null
        : productName,
      subscriptionStatus: subscription.status
    }
  );
}

export function getWebhookOrganizationId(
  subscription: Stripe.Subscription
) {
  return getSubscriptionOrganizationId(
    subscription
  );
}
