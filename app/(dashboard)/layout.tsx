import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/revo/app-shell';
import { getOrganizationForUser } from '@/lib/db/queries';
import { getUnansweredReviewCount } from '@/lib/reviews/queries';

export default async function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const membership = await getOrganizationForUser();

  if (!membership) {
    redirect('/sign-in');
  }

  const inboxCount = await getUnansweredReviewCount(
    membership.organization.id
  );

  return (
    <AppShell
      organizationName={membership.organization.name}
      inboxCount={inboxCount}
    >
      {children}
    </AppShell>
  );
}
