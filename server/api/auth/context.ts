import { and, eq, isNull } from 'drizzle-orm';

import { verifyToken } from '@/lib/auth/token';
import { createWorkerDb } from '@/lib/db/worker';
import {
  organizationMembers,
  organizations,
  users
} from '@/lib/db/schema';

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

  const workerDb = createWorkerDb();

  try {
    const [context] = await workerDb.db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        organizationId: organizations.id,
        organizationName: organizations.name,
        role: organizationMembers.role
      })
      .from(users)
      .innerJoin(
        organizationMembers,
        eq(organizationMembers.userId, users.id)
      )
      .innerJoin(
        organizations,
        eq(
          organizations.id,
          organizationMembers.organizationId
        )
      )
      .where(
        and(
          eq(users.id, session.user.id),
          isNull(users.deletedAt)
        )
      )
      .limit(1);

    if (!context) {
      return null;
    }

    return {
      user: {
        id: context.userId,
        name: context.userName,
        email: context.userEmail
      },
      organization: {
        id: context.organizationId,
        name: context.organizationName
      },
      role: context.role
    };
  } finally {
    await workerDb.client.end();
  }
}
