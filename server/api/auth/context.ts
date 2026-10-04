import { sql } from 'drizzle-orm';

import { verifyToken } from '@/lib/auth/token';
import type { ApiDb } from '../db';

export type AuthenticatedContext = {
  user: {
    id: number;
    name: string | null;
    email: string;
  };
  organization: {
    id: number;
    name: string;
  };
  role: string;
};

export async function resolveAuthenticatedContext(
  db: ApiDb,
  sessionToken: string
): Promise<AuthenticatedContext | null> {
  let session;

  try {
    session = await verifyToken(sessionToken);
  } catch {
    return null;
  }

  if (
    !session?.user ||
    !Number.isInteger(session.user.id) ||
    !session.expires ||
    new Date(session.expires) < new Date()
  ) {
    return null;
  }

  const [context] = await db.execute<{
    user_id: number;
    user_name: string | null;
    user_email: string;
    organization_id: number;
    organization_name: string;
    membership_role: string;
  }>(sql`
    SELECT
      user_id,
      user_name,
      user_email,
      organization_id,
      organization_name,
      membership_role
    FROM public.revo_authenticated_context(
      ${session.user.id}
    )
  `);

  if (!context) {
    return null;
  }

  return {
    user: {
      id: context.user_id,
      name: context.user_name,
      email: context.user_email
    },
    organization: {
      id: context.organization_id,
      name: context.organization_name
    },
    role: context.membership_role
  };
}
