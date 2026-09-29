'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { validatedAction } from '@/lib/auth/middleware';
import { setSession } from '@/lib/auth/session';
import {
  authenticateAccount,
  registerAccount
} from '@/lib/api/server';

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

export const signIn = validatedAction(
  signInSchema,
  async (data, formData) => {
    const { email, password } = data;

    const redirectTo = formData.get('redirect');

    if (redirectTo === 'checkout') {
      return {
        error: 'Billing setup is not available yet.',
        email
      };
    }

    const result = await authenticateAccount(
      email,
      password
    );

    if (!result.success) {
      return {
        error: result.error,
        email
      };
    }

    await setSession(result.user);

    const next = formData.get('next');

    if (
      typeof next === 'string' &&
      next.startsWith('/') &&
      !next.startsWith('//')
    ) {
      redirect(next);
    }

    redirect('/');
  }
);

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional()
});

export const signUp = validatedAction(
  signUpSchema,
  async (data, formData) => {
    const { email, password, inviteId } = data;

    if (inviteId) {
      return {
        error: 'Organization invitations are not available yet.',
        email
      };
    }

    const redirectTo = formData.get('redirect');

    if (redirectTo === 'checkout') {
      return {
        error: 'Billing setup is not available yet.',
        email
      };
    }

    const result = await registerAccount(
      email,
      password
    );

    if (!result.success) {
      return {
        error: result.error,
        email
      };
    }

    await setSession(result.user);

    redirect('/');
  }
);

export async function signOut() {
  (await cookies()).delete('session');
  redirect('/sign-in');
}
