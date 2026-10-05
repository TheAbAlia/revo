import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2025-04-30.basil'
  });

  return stripeClient;
}

function getBaseUrl() {
  const baseUrl = process.env.BASE_URL;

  if (!baseUrl) {
    throw new Error('BASE_URL is not configured');
  }

  return baseUrl.replace(/\/$/, '');
}

export async function createOrganizationCheckoutSession({
  organizationId,
  organizationName,
  priceId,
  stripeCustomerId
}: {
  organizationId: number;
  organizationName: string;
  priceId: string;
  stripeCustomerId: string | null;
}) {
  const stripe = getStripeClient();
  const baseUrl = getBaseUrl();

  const price = await stripe.prices.retrieve(priceId, {
    expand: ['product']
  });

  if (
    !price.active ||
    price.type !== 'recurring' ||
    !price.recurring
  ) {
    throw new Error('Invalid subscription price');
  }

  const product =
    typeof price.product === 'string'
      ? await stripe.products.retrieve(price.product)
      : price.product;

  if (!product || product.deleted || !product.active) {
    throw new Error('Invalid subscription product');
  }

  const metadata = {
    organizationId: String(organizationId)
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price: price.id,
        quantity: 1
      }
    ],
    success_url: `${baseUrl}/pricing?checkout=success`,
    cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
    customer: stripeCustomerId ?? undefined,
    customer_creation: stripeCustomerId
      ? undefined
      : 'always',
    client_reference_id: String(organizationId),
    metadata,
    subscription_data: {
      metadata,
      trial_period_days: 14
    },
    allow_promotion_codes: true
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return {
    url: session.url,
    sessionId: session.id,
    productId: product.id,
    productName: product.name,
    organizationName
  };
}

export async function createOrganizationPortalSession({
  stripeCustomerId,
  stripeProductId
}: {
  stripeCustomerId: string;
  stripeProductId: string;
}) {
  const stripe = getStripeClient();
  const baseUrl = getBaseUrl();

  const configurations =
    await stripe.billingPortal.configurations.list({
      active: true,
      limit: 100
    });

  let configuration =
    configurations.data.find(
      (candidate) =>
        candidate.metadata?.revoManaged === 'true' &&
        candidate.metadata?.productId ===
          stripeProductId
    );

  if (!configuration) {
    const product =
      await stripe.products.retrieve(
        stripeProductId
      );

    if (product.deleted || !product.active) {
      throw new Error(
        'Subscription product is not active in Stripe'
      );
    }

    const prices = await stripe.prices.list({
      product: product.id,
      active: true
    });

    if (prices.data.length === 0) {
      throw new Error(
        'No active prices found for subscription product'
      );
    }

    configuration =
      await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: 'Manage your subscription'
        },
        features: {
          subscription_update: {
            enabled: true,
            default_allowed_updates: [
              'price',
              'quantity',
              'promotion_code'
            ],
            proration_behavior: 'create_prorations',
            products: [
              {
                product: product.id,
                prices: prices.data.map(
                  (price) => price.id
                )
              }
            ]
          },
          subscription_cancel: {
            enabled: true,
            mode: 'at_period_end',
            cancellation_reason: {
              enabled: true,
              options: [
                'too_expensive',
                'missing_features',
                'switched_service',
                'unused',
                'other'
              ]
            }
          },
          payment_method_update: {
            enabled: true
          }
        },
        metadata: {
          revoManaged: 'true',
          productId: product.id
        }
      });
  }

  const session =
    await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/pricing`,
      configuration: configuration.id
    });

  return {
    url: session.url
  };
}

export async function getBillingCatalog() {
  const stripe = getStripeClient();

  const [prices, products] = await Promise.all([
    stripe.prices.list({
      expand: ['data.product'],
      active: true,
      type: 'recurring'
    }),
    stripe.products.list({
      active: true,
      expand: ['data.default_price']
    })
  ]);

  return {
    prices: prices.data.map((price) => ({
      id: price.id,
      productId:
        typeof price.product === 'string'
          ? price.product
          : price.product.id,
      unitAmount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
      trialPeriodDays:
        price.recurring?.trial_period_days ?? null
    })),
    products: products.data.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      defaultPriceId:
        typeof product.default_price === 'string'
          ? product.default_price
          : product.default_price?.id ?? null
    }))
  };
}
