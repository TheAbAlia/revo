import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  NextRequest,
  NextResponse
} from 'next/server';

import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import {
  providerConnections
} from '@/lib/db/schema';
import { getOrganizationForUser } from '@/lib/db/queries';
import {
  fetchGoogleBusinessAccounts
} from '@/lib/integrations/google/accounts';
import {
  exchangeGoogleAuthorizationCode
} from '@/lib/integrations/google/oauth';
import {
  upsertProviderConnection
} from '@/lib/integrations/providers/connections';

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
  const membership = await getOrganizationForUser();

  if (!membership) {
    return NextResponse.redirect(
      new URL('/sign-in', request.url)
    );
  }

  const cookieStore = await cookies();
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
      const [existingConnection] = await db
        .select({
          externalAccountId:
            providerConnections.externalAccountId
        })
        .from(providerConnections)
        .where(
          and(
            eq(
              providerConnections.id,
              reconnectConnectionId
            ),
            eq(
              providerConnections.organizationId,
              membership.organization.id
            ),
            eq(
              providerConnections.provider,
              'google'
            )
          )
        )
        .limit(1);

      if (!existingConnection) {
        return locationsRedirect(
          request,
          'connection-failed'
        );
      }

      if (
        existingConnection.externalAccountId !==
        account.externalAccountId
      ) {
        return locationsRedirect(
          request,
          'account-mismatch'
        );
      }
    }

    await upsertProviderConnection({
      organizationId: membership.organization.id,
      provider: 'google',
      externalAccountId: account.externalAccountId,
      refreshToken: tokens.refreshToken
    });

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
