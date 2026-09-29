'use server';

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  users,
  organizations,
  organizationMembers
} from '@/lib/db/schema';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { validatedAction } from '@/lib/auth/middleware';

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const [foundUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!foundUser) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  const isPasswordValid = await comparePasswords(
    password,
    foundUser.passwordHash
  );

  if (!isPasswordValid) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  const redirectTo = formData.get('redirect') as string | null;

  if (redirectTo === 'checkout') {
    return {
      error: 'Billing setup is not available yet.',
      email,
      password
    };
  }

  await setSession(foundUser);

  const next = formData.get('next');

  if (
    typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//')
  ) {
    redirect(next);
  }

  redirect('/');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional()
});

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

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;

  if (inviteId) {
    return {
      error: 'Organization invitations are not available yet.',
      email,
      password
    };
  }

  const redirectTo = formData.get('redirect') as string | null;

  if (redirectTo === 'checkout') {
    return {
      error: 'Billing setup is not available yet.',
      email,
      password
    };
  }

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password
    };
  }

  const passwordHash = await hashPassword(password);

  const createdUser = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        role: 'owner'
      })
      .returning();

    if (!user) {
      throw new Error('Failed to create user');
    }

    const [organization] = await tx
      .insert(organizations)
      .values({
        name: `${email.split('@')[0]}'s Workspace`,
        slug: createOrganizationSlug(email)
      })
      .returning();

    if (!organization) {
      throw new Error('Failed to create organization');
    }

    await tx.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: user.id,
      role: 'owner'
    });

    return user;
  });

  await setSession(createdUser);

  redirect('/');
});

export async function signOut() {
  (await cookies()).delete('session');
  redirect('/sign-in');
}
