import { cookies } from 'next/headers';
import {
  signToken,
  verifyToken,
  type SessionData
} from '@/lib/auth/token';

export { signToken, verifyToken };

export async function getSession() {
  const session = (await cookies()).get('session')?.value;

  if (!session) {
    return null;
  }

  return verifyToken(session);
}

export async function setSession(user: { id: number }) {
  const expiresInOneDay =
    new Date(Date.now() + 24 * 60 * 60 * 1000);

  const session: SessionData = {
    user: { id: user.id },
    expires: expiresInOneDay.toISOString()
  };

  const encryptedSession = await signToken(session);

  (await cookies()).set('session', encryptedSession, {
    expires: expiresInOneDay,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
}
