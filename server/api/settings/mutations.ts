import { and, eq, ne } from 'drizzle-orm';

import {
  users
} from '@/lib/db/schema';
import {
  comparePasswords,
  hashPassword
} from '@/lib/auth/password';
import type { ApiDb } from '../db';

export async function updateSettingsAccount(
  db: ApiDb,
  userId: number,
  name: string,
  email: string
) {
  const [existingUser] = await db
    .select({
      id: users.id
    })
    .from(users)
    .where(
      and(
        eq(users.email, email),
        ne(users.id, userId)
      )
    )
    .limit(1);

  if (existingUser) {
    return {
      success: false as const,
      error: 'An account with this email already exists.'
    };
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      name,
      email,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning({
      name: users.name,
      email: users.email
    });

  if (!updatedUser) {
    return {
      success: false as const,
      error: 'User not found.'
    };
  }

  return {
    success: true as const,
    user: updatedUser
  };
}

export async function updateSettingsPassword(
  db: ApiDb,
  userId: number,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) {
  const [user] = await db
    .select({
      passwordHash: users.passwordHash
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return {
      success: false as const,
      error: 'User not found.'
    };
  }

  const isPasswordValid = await comparePasswords(
    currentPassword,
    user.passwordHash
  );

  if (!isPasswordValid) {
    return {
      success: false as const,
      error: 'Current password is incorrect.'
    };
  }

  if (currentPassword === newPassword) {
    return {
      success: false as const,
      error: 'New password must be different from the current password.'
    };
  }

  if (confirmPassword !== newPassword) {
    return {
      success: false as const,
      error: 'New password and confirmation password do not match.'
    };
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId));

  return {
    success: true as const
  };
}
