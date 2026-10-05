import Fastify from 'fastify';
import {
  resolveAuthenticatedContext
} from './auth/context';
import {
  getSessionTokenFromRequest
} from './auth/session';
import {
  createApiDb,
  withTenantContext
} from './db';

const API_BODY_LIMIT_BYTES = 64 * 1024;

export function buildApi() {
  const api = Fastify({
    logger: true,
    bodyLimit: API_BODY_LIMIT_BYTES
  });

  api.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_request, body, done) => {
      done(null, body);
    }
  );

  const apiDb = createApiDb();

  api.addHook('onClose', async () => {
    await apiDb.client.end();
  });

  api.get('/health', async () => {
    return {
      status: 'ok',
      service: 'revo-api'
    };
  });

  void api.register(async (authApi) => {
    const { default: rateLimit } =
      await import('@fastify/rate-limit');
    const { registerAuthRoutes } =
      await import('./auth/routes');

    await authApi.register(rateLimit, {
      global: false
    });

    await registerAuthRoutes(authApi, apiDb.db);
  });

  api.get('/v1/me', async (request, reply) => {
    const sessionToken =
      getSessionTokenFromRequest(request);

    if (!sessionToken) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const context =
      await resolveAuthenticatedContext(
        apiDb.db,
        sessionToken
      );

    if (!context) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    return {
      user: context.user,
      organization: context.organization,
      role: context.role
    };
  });

  api.put<{
    Params: {
      reviewId: string;
    };
    Body: {
      content?: unknown;
    };
  }>(
    '/v1/reviews/:reviewId/response',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const reviewId = Number(
        request.params.reviewId
      );

      if (
        !Number.isInteger(reviewId) ||
        reviewId <= 0
      ) {
        return reply.code(400).send({
          error: 'Invalid review'
        });
      }

      const content = request.body?.content;

      if (
        typeof content !== 'string' ||
        !content.trim()
      ) {
        return reply.code(400).send({
          error: 'Response cannot be empty'
        });
      }

      const { saveReviewResponseDraft } =
        await import('./reviews/mutations');

      const result = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          saveReviewResponseDraft(
            tx,
            context.organization.id,
            reviewId,
            content
          )
      );

      if (result.status === 'not-found') {
        return reply.code(404).send({
          error: 'Response not found'
        });
      }

      return {
        success: true
      };
    }
  );

  api.post<{
    Params: {
      reviewId: string;
    };
  }>(
    '/v1/reviews/:reviewId/response/publish',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const reviewId = Number(
        request.params.reviewId
      );

      if (
        !Number.isInteger(reviewId) ||
        reviewId <= 0
      ) {
        return reply.code(400).send({
          error: 'Invalid review'
        });
      }

      const { publishReviewResponse } =
        await import('./reviews/mutations');

      const result = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          publishReviewResponse(
            tx,
            context.organization.id,
            reviewId
          )
      );

      if (result.status === 'not-found') {
        return reply.code(404).send({
          error: 'Review not found'
        });
      }

      if (result.status === 'not-connected') {
        return reply.code(409).send({
          error: 'Location is not connected to Google'
        });
      }

      if (
        result.status === 'response-not-found'
      ) {
        return reply.code(404).send({
          error: 'Response not found'
        });
      }

      if (result.status === 'not-approved') {
        return reply.code(409).send({
          error: 'Response is not approved'
        });
      }

      return {
        success: true,
        jobId: result.jobId,
        created: result.created
      };
    }
  );

  api.post<{
    Params: {
      reviewId: string;
    };
    Body: {
      content?: unknown;
    };
  }>(
    '/v1/reviews/:reviewId/response/approve',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const reviewId = Number(
        request.params.reviewId
      );

      if (
        !Number.isInteger(reviewId) ||
        reviewId <= 0
      ) {
        return reply.code(400).send({
          error: 'Invalid review'
        });
      }

      const content = request.body?.content;

      if (
        typeof content !== 'string' ||
        !content.trim()
      ) {
        return reply.code(400).send({
          error: 'Response cannot be empty'
        });
      }

      const { approveReviewResponse } =
        await import('./reviews/mutations');

      const result = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          approveReviewResponse(
            tx,
            context.organization.id,
            reviewId,
            content
          )
      );

      if (result.status === 'not-found') {
        return reply.code(404).send({
          error: 'Response not found'
        });
      }

      return {
        success: true
      };
    }
  );

  api.post<{
    Params: {
      reviewId: string;
    };
  }>(
    '/v1/reviews/:reviewId/generate/retry',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const reviewId = Number(
        request.params.reviewId
      );

      if (
        !Number.isInteger(reviewId) ||
        reviewId <= 0
      ) {
        return reply.code(400).send({
          error: 'Invalid review'
        });
      }

      const { retryReviewResponseGeneration } =
        await import('./reviews/mutations');

      const result = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          retryReviewResponseGeneration(
            tx,
            context.organization.id,
            reviewId
          )
      );

      if (result.status === 'not-found') {
        return reply.code(404).send({
          error: 'Review not found'
        });
      }

      if (result.status === 'not-retryable') {
        return reply.code(409).send({
          error:
            'There is no failed generation to retry.'
        });
      }

      return {
        success: true,
        jobId: result.jobId,
        created: result.created
      };
    }
  );

  api.post<{
    Params: {
      reviewId: string;
    };
  }>(
    '/v1/reviews/:reviewId/generate',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const reviewId = Number(
        request.params.reviewId
      );

      if (
        !Number.isInteger(reviewId) ||
        reviewId <= 0
      ) {
        return reply.code(400).send({
          error: 'Invalid review'
        });
      }

      const { generateReviewResponse } =
        await import('./reviews/mutations');

      const result = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          generateReviewResponse(
            tx,
            context.organization.id,
            reviewId
          )
      );

      if (!result) {
        return reply.code(404).send({
          error: 'Review not found'
        });
      }

      return {
        success: true,
        ...result
      };
    }
  );

  api.post('/v1/locations', async (request, reply) => {
    const sessionToken =
      getSessionTokenFromRequest(request);

    if (!sessionToken) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const context =
      await resolveAuthenticatedContext(
        apiDb.db,
        sessionToken
      );

    if (!context) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const body = request.body as {
      name?: unknown;
    } | null;

    if (
      !body ||
      typeof body.name !== 'string'
    ) {
      return reply.code(400).send({
        error: 'Invalid location name'
      });
    }

    const name = body.name.trim();

    if (
      name.length < 2 ||
      name.length > 160
    ) {
      return reply.code(400).send({
        error: 'Invalid location name'
      });
    }

    const { createLocation } =
      await import('./locations/mutations');

    const location = await withTenantContext(
      apiDb.db,
      context.organization.id,
      (tx) =>
        createLocation(
          tx,
          context.organization.id,
          name
        )
    );

    return {
      success: true,
      location
    };
  });

  api.post(
    '/v1/locations/:locationId/sync',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const { locationId } =
        request.params as {
          locationId: string;
        };

      const numericLocationId =
        Number(locationId);

      if (
        !Number.isInteger(numericLocationId) ||
        numericLocationId <= 0
      ) {
        return reply.code(400).send({
          error: 'Invalid location'
        });
      }

      const { syncLocationReviews } =
        await import('./locations/mutations');

      const result = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          syncLocationReviews(
            tx,
            context.organization.id,
            numericLocationId
          )
      );

      if (result.status === 'not-found') {
        return reply.code(404).send({
          error: 'Location not found'
        });
      }

      if (result.status === 'not-connected') {
        return reply.code(409).send({
          error:
            'Location is not connected to a provider'
        });
      }

      if (result.status === 'needs-reauth') {
        return reply.code(409).send({
          error:
            'Provider connection requires reauthorization'
        });
      }

      return {
        success: true,
        jobId: result.jobId,
        created: result.created
      };
    }
  );

  api.get('/v1/locations', async (request, reply) => {
    const sessionToken =
      getSessionTokenFromRequest(request);

    if (!sessionToken) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const context =
      await resolveAuthenticatedContext(
        apiDb.db,
        sessionToken
      );

    if (!context) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const { getLocations } =
      await import('./locations/queries');

    const locationRows = await withTenantContext(
      apiDb.db,
      context.organization.id,
      (tx) =>
        getLocations(
          tx,
          context.organization.id
        )
    );

    return {
      locations: locationRows
    };
  });

  api.post<{
    Body: Buffer;
  }>('/v1/billing/webhook', async (request, reply) => {
    const signature =
      request.headers['stripe-signature'];

    if (
      typeof signature !== 'string' ||
      !signature
    ) {
      return reply.code(400).send({
        error: 'Missing Stripe signature'
      });
    }

    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error(
        'STRIPE_WEBHOOK_SECRET is not configured'
      );
    }

    const {
      getStripeClient
    } = await import('./billing/stripe');

    const stripe = getStripeClient();

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        signature,
        webhookSecret
      );
    } catch {
      return reply.code(400).send({
        error: 'Invalid Stripe signature'
      });
    }

    if (
      event.type !==
        'customer.subscription.created' &&
      event.type !==
        'customer.subscription.updated' &&
      event.type !==
        'customer.subscription.deleted'
    ) {
      return {
        received: true
      };
    }

    const subscription = event.data.object;

    const {
      getWebhookOrganizationId,
      applySubscriptionWebhook
    } = await import('./billing/webhook');

    const organizationId =
      getWebhookOrganizationId(subscription);

    if (organizationId === null) {
      return reply.code(400).send({
        error: 'Missing organization metadata'
      });
    }

    let productName: string | null = null;

    if (
      subscription.status !== 'canceled' &&
      subscription.status !== 'unpaid'
    ) {
      const product =
        subscription.items.data[0]?.price.product;

      if (product) {
        if (typeof product === 'string') {
          const stripeProduct =
            await stripe.products.retrieve(product);

          if (!stripeProduct.deleted) {
            productName = stripeProduct.name;
          }
        } else if (!product.deleted) {
          productName = product.name;
        }
      }
    }

    try {
      await withTenantContext(
        apiDb.db,
        organizationId,
        (tx) =>
          applySubscriptionWebhook(
            tx,
            organizationId,
            subscription,
            productName
          )
      );
    } catch (error) {
      request.log.error(
        { err: error },
        'Stripe billing webhook rejected'
      );

      return reply.code(409).send({
        error: 'Billing webhook rejected'
      });
    }

    return {
      received: true
    };
  });

  api.get('/v1/billing/catalog', async () => {
    const { getBillingCatalog } =
      await import('./billing/stripe');

    return getBillingCatalog();
  });

  api.get('/v1/billing', async (request, reply) => {
    const sessionToken =
      getSessionTokenFromRequest(request);

    if (!sessionToken) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const context =
      await resolveAuthenticatedContext(
        apiDb.db,
        sessionToken
      );

    if (!context) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const { getOrganizationBilling } =
      await import('./billing/queries');

    const billing = await withTenantContext(
      apiDb.db,
      context.organization.id,
      (tx) =>
        getOrganizationBilling(
          tx,
          context.organization.id
        )
    );

    return {
      organization: context.organization,
      billing
    };
  });

  api.post<{
    Body: {
      priceId?: unknown;
    };
  }>('/v1/billing/checkout', async (request, reply) => {
    const sessionToken =
      getSessionTokenFromRequest(request);

    if (!sessionToken) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const context =
      await resolveAuthenticatedContext(
        apiDb.db,
        sessionToken
      );

    if (!context) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const priceId = request.body?.priceId;

    if (
      typeof priceId !== 'string' ||
      !priceId.trim()
    ) {
      return reply.code(400).send({
        error: 'Invalid price'
      });
    }

    const { getOrganizationBilling } =
      await import('./billing/queries');

    const billing = await withTenantContext(
      apiDb.db,
      context.organization.id,
      (tx) =>
        getOrganizationBilling(
          tx,
          context.organization.id
        )
    );

    const { createOrganizationCheckoutSession } =
      await import('./billing/stripe');

    const checkout =
      await createOrganizationCheckoutSession({
        organizationId: context.organization.id,
        organizationName: context.organization.name,
        priceId: priceId.trim(),
        stripeCustomerId:
          billing?.stripeCustomerId ?? null
      });

    return checkout;
  });

  api.post('/v1/billing/portal', async (request, reply) => {
    const sessionToken =
      getSessionTokenFromRequest(request);

    if (!sessionToken) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const context =
      await resolveAuthenticatedContext(
        apiDb.db,
        sessionToken
      );

    if (!context) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const { getOrganizationBilling } =
      await import('./billing/queries');

    const billing = await withTenantContext(
      apiDb.db,
      context.organization.id,
      (tx) =>
        getOrganizationBilling(
          tx,
          context.organization.id
        )
    );

    if (
      !billing?.stripeCustomerId ||
      !billing.stripeProductId
    ) {
      return reply.code(409).send({
        error: 'No active billing account'
      });
    }

    const { createOrganizationPortalSession } =
      await import('./billing/stripe');

    return createOrganizationPortalSession({
      stripeCustomerId: billing.stripeCustomerId,
      stripeProductId: billing.stripeProductId
    });
  });

  api.get('/v1/reviews', async (request, reply) => {
    const sessionToken =
      getSessionTokenFromRequest(request);

    if (!sessionToken) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const context =
      await resolveAuthenticatedContext(
        apiDb.db,
        sessionToken
      );

    if (!context) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const { getReviewInbox } =
      await import('./reviews/queries');

    const items = await withTenantContext(
      apiDb.db,
      context.organization.id,
      (tx) =>
        getReviewInbox(
          tx,
          context.organization.id
        )
    );

    return {
      items
    };
  });

  api.get('/v1/dashboard/shell', async (request, reply) => {
    const sessionToken =
      getSessionTokenFromRequest(request);

    if (!sessionToken) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const context =
      await resolveAuthenticatedContext(
        apiDb.db,
        sessionToken
      );

    if (!context) {
      return reply.code(401).send({
        error: 'Unauthorized'
      });
    }

    const { getDashboardShell } =
      await import('./dashboard/queries');

    const shell = await withTenantContext(
      apiDb.db,
      context.organization.id,
      (tx) =>
        getDashboardShell(
          tx,
          context.organization.id
        )
    );

    return {
      organization: context.organization,
      inboxCount: shell.inboxCount
    };
  });

  api.get(
    '/v1/provider-connections/google/:connectionId',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const { connectionId } =
        request.params as {
          connectionId: string;
        };

      const numericConnectionId =
        Number(connectionId);

      if (
        !Number.isInteger(numericConnectionId) ||
        numericConnectionId <= 0
      ) {
        return reply.code(400).send({
          error: 'Invalid provider connection'
        });
      }

      const { getGoogleProviderConnection } =
        await import(
          './provider-connections/mutations'
        );

      const connection = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          getGoogleProviderConnection(
            tx,
            context.organization.id,
            numericConnectionId
          )
      );

      if (!connection) {
        return reply.code(404).send({
          error: 'Provider connection not found'
        });
      }

      return {
        connection
      };
    }
  );

  api.post(
    '/v1/provider-connections/google',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const body = request.body as {
        externalAccountId?: unknown;
        refreshToken?: unknown;
      } | null;

      if (
        !body ||
        typeof body.externalAccountId !== 'string' ||
        !body.externalAccountId.trim() ||
        typeof body.refreshToken !== 'string' ||
        !body.refreshToken.trim()
      ) {
        return reply.code(400).send({
          error: 'Invalid provider connection'
        });
      }

      const externalAccountId =
        body.externalAccountId;
      const refreshToken = body.refreshToken;

      const {
        upsertGoogleProviderConnection
      } = await import(
        './provider-connections/mutations'
      );

      const connection = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          upsertGoogleProviderConnection(
            tx,
            context.organization.id,
            externalAccountId,
            refreshToken
          )
      );

      return {
        success: true,
        connection
      };
    }
  );

  api.get(
    '/v1/brand-voice',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const { getDefaultBrandVoice } =
        await import('./brand-voice/mutations');

      const brandVoice = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          getDefaultBrandVoice(
            tx,
            context.organization.id
          )
      );

      return {
        organization: context.organization,
        brandVoice
      };
    }
  );

  api.put(
    '/v1/brand-voice',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const body = request.body as {
        name?: unknown;
        instructions?: unknown;
      } | null;

      if (
        !body ||
        typeof body.name !== 'string' ||
        !body.name.trim()
      ) {
        return reply.code(400).send({
          error: 'Voice name is required.'
        });
      }

      if (
        typeof body.instructions !== 'string' ||
        !body.instructions.trim()
      ) {
        return reply.code(400).send({
          error:
            'Brand voice instructions are required.'
        });
      }

      const name = body.name.trim();
      const instructions =
        body.instructions.trim();

      if (name.length > 100) {
        return reply.code(400).send({
          error:
            'Voice name must be 100 characters or fewer.'
        });
      }

      if (instructions.length > 4000) {
        return reply.code(400).send({
          error:
            'Brand voice instructions must be 4,000 characters or fewer.'
        });
      }

      const { saveDefaultBrandVoice } =
        await import('./brand-voice/mutations');

      const brandVoice = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          saveDefaultBrandVoice(
            tx,
            context.organization.id,
            name,
            instructions
          )
      );

      return {
        success: true,
        brandVoice
      };
    }
  );

  api.get(
    '/v1/automations',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const { getAutomationSettings } =
        await import('./automations/mutations');

      const settings = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          getAutomationSettings(
            tx,
            context.organization.id
          )
      );

      return {
        settings
      };
    }
  );

  api.put(
    '/v1/automations',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const body = request.body as {
        autoGenerateDrafts?: unknown;
      } | null;

      if (
        !body ||
        typeof body.autoGenerateDrafts !== 'boolean'
      ) {
        return reply.code(400).send({
          error: 'Invalid automation settings'
        });
      }

      const autoGenerateDrafts =
        body.autoGenerateDrafts;

      const { saveAutomationSettings } =
        await import('./automations/mutations');

      const settings = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          saveAutomationSettings(
            tx,
            context.organization.id,
            autoGenerateDrafts
          )
      );

      return {
        success: true,
        settings
      };
    }
  );

  api.get(
    '/v1/analytics',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const { getAnalyticsOverview } =
        await import('./analytics/queries');

      const analytics = await withTenantContext(
        apiDb.db,
        context.organization.id,
        (tx) =>
          getAnalyticsOverview(
            tx,
            context.organization.id
          )
      );

      return {
        analytics
      };
    }
  );

  api.get(
    '/v1/settings',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      return {
        settings: {
          user: context.user,
          organization: context.organization,
          role: context.role
        }
      };
    }
  );

  api.put(
    '/v1/settings/account',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const body = request.body as {
        name?: unknown;
        email?: unknown;
      } | null;

      const name =
        typeof body?.name === 'string'
          ? body.name.trim()
          : '';

      const email =
        typeof body?.email === 'string'
          ? body.email.trim()
          : '';

      if (!name) {
        return reply.code(400).send({
          error: 'Name is required'
        });
      }

      if (name.length > 100) {
        return reply.code(400).send({
          error: 'Name must be 100 characters or fewer.'
        });
      }

      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return reply.code(400).send({
          error: 'Invalid email address'
        });
      }

      const { updateSettingsAccount } =
        await import('./settings/mutations');

      const result =
        await updateSettingsAccount(
          apiDb.db,
          context.user.id,
          name,
          email
        );

      if (!result.success) {
        return reply.code(
          result.error === 'User not found.'
            ? 404
            : 409
        ).send({
          error: result.error
        });
      }

      return {
        success: true,
        user: result.user
      };
    }
  );

  api.put(
    '/v1/settings/password',
    async (request, reply) => {
      const sessionToken =
        getSessionTokenFromRequest(request);

      if (!sessionToken) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const context =
        await resolveAuthenticatedContext(
          apiDb.db,
          sessionToken
        );

      if (!context) {
        return reply.code(401).send({
          error: 'Unauthorized'
        });
      }

      const body = request.body as {
        currentPassword?: unknown;
        newPassword?: unknown;
        confirmPassword?: unknown;
      } | null;

      const currentPassword =
        typeof body?.currentPassword === 'string'
          ? body.currentPassword
          : '';

      const newPassword =
        typeof body?.newPassword === 'string'
          ? body.newPassword
          : '';

      const confirmPassword =
        typeof body?.confirmPassword === 'string'
          ? body.confirmPassword
          : '';

      if (
        currentPassword.length < 8 ||
        currentPassword.length > 100 ||
        newPassword.length < 8 ||
        newPassword.length > 100 ||
        confirmPassword.length < 8 ||
        confirmPassword.length > 100
      ) {
        return reply.code(400).send({
          error: 'Passwords must be between 8 and 100 characters.'
        });
      }

      const { updateSettingsPassword } =
        await import('./settings/mutations');

      const result =
        await updateSettingsPassword(
          apiDb.db,
          context.user.id,
          currentPassword,
          newPassword,
          confirmPassword
        );

      if (!result.success) {
        return reply.code(
          result.error === 'User not found.'
            ? 404
            : 400
        ).send({
          error: result.error
        });
      }

      return {
        success: true
      };
    }
  );

  return api;
}
