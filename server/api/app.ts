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
