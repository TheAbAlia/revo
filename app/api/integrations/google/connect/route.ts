import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getOrganizationForUser } from '@/lib/db/queries';
import { createGoogleAuthorizationUrl } from '@/lib/integrations/google/oauth';

const OAUTH_STATE_COOKIE = 'revo_google_oauth_state';
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

export async function GET() {
  const membership = await getOrganizationForUser();

  if (!membership) {
    return NextResponse.redirect(
      new URL('/sign-in', process.env.BASE_URL)
    );
  }

  const state = randomBytes(32).toString('base64url');
  const authorizationUrl = createGoogleAuthorizationUrl(state);

  const cookieStore = await cookies();

  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/integrations/google',
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(authorizationUrl);
}
