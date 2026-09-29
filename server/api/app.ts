import Fastify from 'fastify';

import {
  resolveAuthenticatedContext
} from './auth/context';
import {
  getSessionTokenFromRequest
} from './auth/session';
import { createApiDb } from './db';

export function buildApi() {
  const api = Fastify({
    logger: true
  });

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

      const result = await saveReviewResponseDraft(
        apiDb.db,
        context.organization.id,
        reviewId,
        content
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

      const result = await publishReviewResponse(
        apiDb.db,
        context.organization.id,
        reviewId
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

      const result = await approveReviewResponse(
        apiDb.db,
        context.organization.id,
        reviewId,
        content
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

      const result =
        await retryReviewResponseGeneration(
          apiDb.db,
          context.organization.id,
          reviewId
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

      const result = await generateReviewResponse(
        apiDb.db,
        context.organization.id,
        reviewId
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

    const location = await createLocation(
      apiDb.db,
      context.organization.id,
      name
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

      const result =
        await syncLocationReviews(
          apiDb.db,
          context.organization.id,
          numericLocationId
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

    const locationRows = await getLocations(
      apiDb.db,
      context.organization.id
    );

    return {
      locations: locationRows
    };
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

    const items = await getReviewInbox(
      apiDb.db,
      context.organization.id
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

    const shell = await getDashboardShell(
      apiDb.db,
      context.organization.id
    );

    return {
      organization: context.organization,
      inboxCount: shell.inboxCount
    };
  });

  return api;
}
