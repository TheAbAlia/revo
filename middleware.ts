import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/token';

const PUBLIC_ROUTES = new Set([
  '/sign-in',
  '/sign-up',
]);

const PUBLIC_API_ROUTES = new Set([
  '/api/stripe/webhook',
]);

function isPublicRoute(pathname: string) {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    PUBLIC_API_ROUTES.has(pathname)
  );
}

function createContentSecurityPolicy(nonce: string) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${
      isDevelopment ? " 'unsafe-eval'" : ''
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

function createRequestHeaders(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const contentSecurityPolicy =
    createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(
    'Content-Security-Policy',
    contentSecurityPolicy
  );

  return {
    contentSecurityPolicy,
    requestHeaders
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const {
    contentSecurityPolicy,
    requestHeaders
  } = createRequestHeaders(request);

  if (isPublicRoute(pathname)) {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });

    response.headers.set(
      'Content-Security-Policy',
      contentSecurityPolicy
    );

    return response;
  }

  const sessionCookie = request.cookies.get('session');

  if (!sessionCookie) {
    const signInUrl = new URL('/sign-in', request.url);

    if (request.method === 'GET') {
      signInUrl.searchParams.set(
        'next',
        `${pathname}${request.nextUrl.search}`
      );
    }

    return NextResponse.redirect(signInUrl);
  }

  try {
    const parsed = await verifyToken(sessionCookie.value);
    const response = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });

    response.headers.set(
      'Content-Security-Policy',
      contentSecurityPolicy
    );

    if (request.method === 'GET') {
      const expiresInOneDay = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );

      response.cookies.set({
        name: 'session',
        value: await signToken({
          ...parsed,
          expires: expiresInOneDay.toISOString(),
        }),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresInOneDay,
      });
    }

    return response;
  } catch {
    const signInUrl = new URL('/sign-in', request.url);

    if (request.method === 'GET') {
      signInUrl.searchParams.set(
        'next',
        `${pathname}${request.nextUrl.search}`
      );
    }

    const response = NextResponse.redirect(signInUrl);
    response.cookies.delete('session');

    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
  runtime: 'nodejs',
};
