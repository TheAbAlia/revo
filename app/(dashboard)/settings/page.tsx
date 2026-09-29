import { redirect } from 'next/navigation';
import { Building2, ShieldCheck, UserRound } from 'lucide-react';
import {
  AccountSettingsForm,
  PasswordSettingsForm
} from '@/components/revo/settings-forms';
import { getSettings } from '@/lib/api/server';

export default async function SettingsPage() {
  const result = await getSettings();

  if (
    !result.success &&
    result.error === 'Unauthorized'
  ) {
    redirect('/sign-in');
  }

  if (!result.success) {
    throw new Error(result.error);
  }

  const { user, organization, role } =
    result.settings;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="border-b px-6 py-5">
        <h1 className="text-lg font-semibold tracking-[-0.025em]">
          Settings
        </h1>

        <p className="mt-1 text-xs text-muted-foreground">
          Manage your account and workspace.
        </p>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <section>
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Account</h2>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Your personal details used to sign in to Revo.
          </p>

          <AccountSettingsForm
            name={user.name ?? ''}
            email={user.email}
          />
        </section>

        <section className="mt-8 border-t pt-8">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Workspace</h2>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            The organization currently associated with this workspace.
          </p>

          <div className="mt-4 rounded-lg border bg-surface px-5 py-5">
            <div className="text-[11px] text-muted-foreground">
              Workspace name
            </div>
            <div className="mt-1 text-[13px] font-medium">
              {organization.name}
            </div>

            <div className="mt-4 text-[11px] text-muted-foreground">
              Your role
            </div>
            <div className="mt-1 text-[13px] font-medium capitalize">
              {role}
            </div>
          </div>
        </section>

        <section className="mt-8 border-t pt-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Security</h2>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Change the password used to access your account.
          </p>

          <PasswordSettingsForm />
        </section>
      </div>
    </div>
  );
}
