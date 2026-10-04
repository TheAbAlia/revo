import { and, eq, isNull } from 'drizzle-orm';

import {
  organizationMembers,
  organizations,
  users
} from '@/lib/db/schema';
import {
  comparePasswords,
  hashPassword
} from '@/lib/auth/password';
import {
  setTenantContext,
  type ApiDb
} from '../db';

function createOrganizationSlug(email: string) {
  const base =
    email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'workspace';

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function authenticateUser(
  db: ApiDb,
  email: string,
  password: string
) {
  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(
      and(
        eq(users.email, email),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!user) {
    return null;
  }

  const valid = await comparePasswords(
    password,
    user.passwordHash
  );

  if (!valid) {
    return null;
  }

  return {
    id: user.id
  };
}

export async function registerUser(
  db: ApiDb,
  email: string,
  password: string
) {
  const [existingUser] = await db
    .select({
      id: users.id
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    return null;
  }

  const passwordHash = await hashPassword(password);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        role: 'owner'
      })
      .returning({
        id: users.id
      });

    if (!user) {
      throw new Error('Failed to create user');
    }

    const [organization] = await tx
      .insert(organizations)
      .values({
        name: `${email.split('@')[0]}'s Workspace`,
        slug: createOrganizationSlug(email)
      })
      .returning({
        id: organizations.id
      });

    if (!organization) {
      throw new Error('Failed to create organization');
    }

    await setTenantContext(tx, organization.id);

    await tx
      .insert(organizationMembers)
      .values({
        organizationId: organization.id,
        userId: user.id,
        role: 'owner'
      });

    return {
      id: user.id
    };
  });
}
