import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  NextRequest,
  NextResponse
} from 'next/server';

import {
  getAuthenticatedContext,
  getGoogleProviderConnection
} from '@/lib/api/server';
import {
  createGoogleAuthorizationUrl
} from '@/lib/integrations/google/oauth';

const OAUTH_STATE_COOKIE = 'revo_google_oauth_state';
const OAUTH_CONNECTION_COOKIE =
  'revo_google_oauth_connection';
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

export async function GET(request: NextRequest) {
  const authenticated =
    await getAuthenticatedContext();

  if (!authenticated) {
    return NextResponse.redirect(
      new URL('/sign-in', request.url)
    );
  }

  const reconnect =
    request.nextUrl.searchParams.get('mode') ===
    'reconnect';

  const requestedConnectionId = Number(
    request.nextUrl.searchParams.get('connectionId')
  );

  let reconnectConnectionId: number | null = null;

  if (reconnect) {
    if (
      !Number.isInteger(requestedConnectionId) ||
      requestedConnectionId <= 0
    ) {
      return NextResponse.json(
        { error: 'Invalid provider connection' },
        { status: 400 }
      );
    }

    const result =
      await getGoogleProviderConnection(
        requestedConnectionId
      );

    if (
      !result.success &&
      result.error === 'Unauthorized'
    ) {
      return NextResponse.redirect(
        new URL('/sign-in', request.url)
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'Provider connection not found' },
        { status: 404 }
      );
    }

    reconnectConnectionId =
      result.connection.id;
  }

  const state =
    randomBytes(32).toString('base64url');

  const authorizationUrl =
    createGoogleAuthorizationUrl(state, {
      promptForConsent: reconnect
    });

  const cookieStore = await cookies();

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/integrations/google',
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS
  };

  cookieStore.set(
    OAUTH_STATE_COOKIE,
    state,
    cookieOptions
  );

  if (reconnectConnectionId) {
    cookieStore.set(
      OAUTH_CONNECTION_COOKIE,
      String(reconnectConnectionId),
      cookieOptions
    );
  } else {
    cookieStore.delete(OAUTH_CONNECTION_COOKIE);
  }

  return NextResponse.redirect(authorizationUrl);
}
