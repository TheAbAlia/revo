import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({
  children,
  organizationName,
  inboxCount
}: {
  children: ReactNode;
  organizationName: string;
  inboxCount: number;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        organizationName={organizationName}
        inboxCount={inboxCount}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main className="min-h-0 flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
