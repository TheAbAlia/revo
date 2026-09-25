import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationForUser } from '@/lib/db/queries';

const OAUTH_STATE_COOKIE = 'revo_google_oauth_state';

function statesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function GET(request: NextRequest) {
  const membership = await getOrganizationForUser();

  if (!membership) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  const receivedState = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (error) {
    return NextResponse.json(
      { error: 'Google authorization was not completed' },
      { status: 400 }
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

  return NextResponse.json({
    ok: true,
    message: 'Google OAuth callback validated',
  });
}
