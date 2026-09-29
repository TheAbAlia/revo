'use client';

import { useActionState } from 'react';
import { updateAccount, updatePassword } from '@/app/(login)/actions';

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

export function AccountSettingsForm({
  name,
  email
}: {
  name: string;
  email: string;
}) {
  const [state, action, pending] = useActionState<
    AccountState,
    FormData
  >(updateAccount, {});

  return (
    <form action={action} className="mt-4 rounded-lg border bg-surface">
      <div className="space-y-4 px-5 py-5">
        <div>
          <label
            htmlFor="settings-name"
            className="text-xs font-medium"
          >
            Name
          </label>
          <input
            id="settings-name"
            name="name"
            defaultValue={state.name ?? name}
            required
            maxLength={100}
            className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label
            htmlFor="settings-email"
            className="text-xs font-medium"
          >
            Email
          </label>
          <input
            id="settings-email"
            name="email"
            type="email"
            defaultValue={state.email ?? email}
            required
            className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}

        {state.success ? (
          <p className="text-xs text-muted-foreground">
            {state.success}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end border-t px-5 py-3">
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

export function PasswordSettingsForm() {
  const [state, action, pending] = useActionState<
    PasswordState,
    FormData
  >(updatePassword, {});

  return (
    <form action={action} className="mt-4 rounded-lg border bg-surface">
      <div className="space-y-4 px-5 py-5">
        <div>
          <label
            htmlFor="current-password"
            className="text-xs font-medium"
          >
            Current password
          </label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={100}
            className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label
            htmlFor="new-password"
            className="text-xs font-medium"
          >
            New password
          </label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={100}
            className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="text-xs font-medium"
          >
            Confirm new password
          </label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={100}
            className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}

        {state.success ? (
          <p className="text-xs text-muted-foreground">
            {state.success}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end border-t px-5 py-3">
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-md border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {pending ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}
