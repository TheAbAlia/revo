import type { FastifyInstance } from 'fastify';

import type { ApiDb } from '../db';
import {
  validateEmail,
  validatePassword
} from './validation';

export const AUTH_RATE_LIMITS = {
  signIn: {
    max: 10,
    timeWindow: '1 minute'
  },
  signUp: {
    max: 5,
    timeWindow: '1 hour'
  }
} as const;

export async function registerAuthRoutes(
  api: FastifyInstance,
  db: ApiDb
) {
  api.post(
    '/v1/auth/sign-in',
    {
      config: {
        rateLimit: AUTH_RATE_LIMITS.signIn
      }
    },
    async (request, reply) => {
      const body = request.body as {
        email?: unknown;
        password?: unknown;
      } | null;

      const email = validateEmail(body?.email);
      const password = validatePassword(body?.password);

      if (!email || !password) {
        return reply.code(400).send({
          error: 'Invalid email or password.'
        });
      }

      const { authenticateUser } =
        await import('./mutations');

      const user = await authenticateUser(
        db,
        email,
        password
      );

      if (!user) {
        return reply.code(401).send({
          error: 'Invalid email or password.'
        });
      }

      return {
        user
      };
    }
  );

  api.post(
    '/v1/auth/sign-up',
    {
      config: {
        rateLimit: AUTH_RATE_LIMITS.signUp
      }
    },
    async (request, reply) => {
      const body = request.body as {
        email?: unknown;
        password?: unknown;
      } | null;

      const email = validateEmail(body?.email);
      const password = validatePassword(body?.password);

      if (!email || !password) {
        return reply.code(400).send({
          error: 'Invalid account details.'
        });
      }

      const { registerUser } =
        await import('./mutations');

      const user = await registerUser(
        db,
        email,
        password
      );

      if (!user) {
        return reply.code(409).send({
          error: 'Failed to create user. Please try again.'
        });
      }

      return reply.code(201).send({
        user
      });
    }
  );
}
