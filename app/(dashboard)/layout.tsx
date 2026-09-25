import type { ReactNode } from 'react';
import { AppShell } from '@/components/revo/app-shell';

export default function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
