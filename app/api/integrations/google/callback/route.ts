import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  NextRequest,
  NextResponse
} from 'next/server';

import {
  getGoogleProviderConnection,
  saveGoogleProviderConnection
} from '@/lib/api/server';
import {
  fetchGoogleBusinessAccounts
} from '@/lib/integrations/google/accounts';
import {
  exchangeGoogleAuthorizationCode
} from '@/lib/integrations/google/oauth';

const OAUTH_STATE_COOKIE = 'revo_google_oauth_state';
const OAUTH_CONNECTION_COOKIE =
  'revo_google_oauth_connection';

function statesMatch(
  expected: string,
  received: string
): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

function locationsRedirect(
  request: NextRequest,
  status: string
) {
  const url = new URL('/locations', request.url);
  url.searchParams.set('google', status);

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();

  if (!cookieStore.get('session')?.value) {
    return NextResponse.redirect(
      new URL('/sign-in', request.url)
    );
  }

  const expectedState =
    cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const reconnectConnectionId = Number(
    cookieStore.get(OAUTH_CONNECTION_COOKIE)?.value
  );

  const receivedState =
    request.nextUrl.searchParams.get('state');
  const code =
    request.nextUrl.searchParams.get('code');
  const error =
    request.nextUrl.searchParams.get('error');

  cookieStore.delete(OAUTH_STATE_COOKIE);
  cookieStore.delete(OAUTH_CONNECTION_COOKIE);

  if (error) {
    return locationsRedirect(
      request,
      'authorization-cancelled'
    );
  }

  if (
    !expectedState ||
    !receivedState ||
    !statesMatch(expectedState, receivedState)
  ) {
    return NextResponse.json(
      { error: 'Invalid OAuth state' },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Missing authorization code' },
      { status: 400 }
    );
  }

  try {
    const tokens =
      await exchangeGoogleAuthorizationCode(code);

    if (!tokens.refreshToken) {
      return locationsRedirect(
        request,
        'missing-refresh-token'
      );
    }

    const accounts =
      await fetchGoogleBusinessAccounts(
        tokens.accessToken
      );

    if (accounts.length === 0) {
      return locationsRedirect(
        request,
        'no-accounts'
      );
    }

    if (accounts.length > 1) {
      return locationsRedirect(
        request,
        'multiple-accounts'
      );
    }

    const account = accounts[0];

    if (
      Number.isInteger(reconnectConnectionId) &&
      reconnectConnectionId > 0
    ) {
      const existing =
        await getGoogleProviderConnection(
          reconnectConnectionId
        );

      if (!existing.success) {
        return locationsRedirect(
          request,
          'connection-failed'
        );
      }

      if (
        existing.connection.externalAccountId !==
        account.externalAccountId
      ) {
        return locationsRedirect(
          request,
          'account-mismatch'
        );
      }
    }

    const saved =
      await saveGoogleProviderConnection(
        account.externalAccountId,
        tokens.refreshToken
      );

    if (!saved.success) {
      return locationsRedirect(
        request,
        'connection-failed'
      );
    }

    return locationsRedirect(
      request,
      'connected'
    );
  } catch (error) {
    console.error(
      'Google OAuth connection failed',
      error
    );

    return locationsRedirect(
      request,
      'connection-failed'
    );
  }
}
