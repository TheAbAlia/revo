import type { FastifyRequest } from 'fastify';

export function getSessionTokenFromRequest(
  request: FastifyRequest
): string | null {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();

    if (name !== 'session') {
      continue;
    }

    const value = part.slice(separator + 1).trim();

    return value || null;
  }

  return null;
}
