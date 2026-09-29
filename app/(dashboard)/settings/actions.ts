'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  saveSettingsAccount,
  saveSettingsPassword
} from '@/lib/api/server';

type AccountState = {
  name?: string;
  email?: string;
  error?: string;
  success?: string;
};

type PasswordState = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  error?: string;
  success?: string;
};

export async function updateSettingsAccount(
  _state: AccountState,
  formData: FormData
): Promise<AccountState> {
  const name = String(
    formData.get('name') ?? ''
  );

  const email = String(
    formData.get('email') ?? ''
  );

  const result = await saveSettingsAccount(
    name,
    email
  );

  if (
    !result.success &&
    result.error === 'Unauthorized'
  ) {
    redirect('/sign-in');
  }

  if (!result.success) {
    return {
      name,
      email,
      error: result.error
    };
  }

  revalidatePath('/settings');

  return {
    name,
    email,
    success: 'Account updated successfully.'
  };
}

export async function updateSettingsPassword(
  _state: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const currentPassword = String(
    formData.get('currentPassword') ?? ''
  );

  const newPassword = String(
    formData.get('newPassword') ?? ''
  );

  const confirmPassword = String(
    formData.get('confirmPassword') ?? ''
  );

  const result = await saveSettingsPassword(
    currentPassword,
    newPassword,
    confirmPassword
  );

  if (
    !result.success &&
    result.error === 'Unauthorized'
  ) {
    redirect('/sign-in');
  }

  if (!result.success) {
    return {
      currentPassword,
      newPassword,
      confirmPassword,
      error: result.error
    };
  }

  return {
    success: 'Password updated successfully.'
  };
}
