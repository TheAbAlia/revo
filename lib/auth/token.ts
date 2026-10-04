import { SignJWT, jwtVerify } from 'jose';

const authSecret = process.env.AUTH_SECRET;

if (!authSecret) {
  throw new Error('AUTH_SECRET is required');
}

const key = Buffer.from(authSecret, 'base64');

if (key.length !== 32) {
  throw new Error(
    'AUTH_SECRET must be a base64-encoded 32-byte key'
  );
}

export type SessionData = {
  user: { id: number };
  expires: string;
};

export async function signToken(payload: SessionData) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1 day from now')
    .sign(key);
}

export async function verifyToken(input: string) {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256']
  });

  return payload as SessionData;
}
