import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/revo/app-shell';
import { getDashboardShell } from '@/lib/api/server';

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const shell = await getDashboardShell();

  if (!shell) {
    redirect('/sign-in');
  }

  return (
    <AppShell
      organizationName={shell.organization.name}
      inboxCount={shell.inboxCount}
    >
      {children}
    </AppShell>
  );
}
