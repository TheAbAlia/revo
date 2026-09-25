'use client';

import {
  BarChart3,
  Building2,
  Inbox,
  MessageSquareText,
  Settings,
  Sparkles,
  Workflow
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/(login)/actions';

const primaryNavigation = [
  {
    label: 'Inbox',
    href: '/',
    icon: Inbox,
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3
  },
  {
    label: 'Locations',
    href: '/locations',
    icon: Building2
  },
  {
    label: 'Automations',
    href: '/automations',
    icon: Workflow
  }
];

const secondaryNavigation = [
  {
    label: 'Brand Voice',
    href: '/brand-voice',
    icon: MessageSquareText
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings
  }
];

function NavItem({
  label,
  href,
  icon: Icon,
  count
}: {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}) {
  const pathname = usePathname();

  const active =
    href === '/'
      ? pathname === '/'
      : pathname.startsWith(href);

  return (
    <a
      href={href}
      className={[
        'group flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />

      <span className="flex-1">{label}</span>

      {count !== undefined && (
        <span
          className={[
            'text-[11px]',
            active
              ? 'text-background/70'
              : 'text-muted-foreground'
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </a>
  );
}

export function Sidebar({ organizationName, inboxCount }: { organizationName: string; inboxCount: number }) {
  return (
    <aside className="flex h-screen w-[232px] shrink-0 flex-col border-r bg-surface px-3 py-4">
      <div className="mb-7 flex h-8 items-center gap-2 px-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background">
          <Sparkles className="h-3.5 w-3.5" />
        </div>

        <span className="text-[15px] font-semibold tracking-[-0.02em]">
          Revo
        </span>
      </div>

      <nav className="space-y-1">
        {primaryNavigation.map((item) => (
          <NavItem key={item.label} {...item} count={item.href === '/' ? inboxCount : undefined} />
        ))}
      </nav>

      <div className="my-4 border-t" />

      <nav className="space-y-1">
        {secondaryNavigation.map((item) => (
          <NavItem key={item.label} {...item} count={item.href === '/' ? inboxCount : undefined} />
        ))}
      </nav>

      <div className="mt-auto border-t pt-3">
        <div className="px-2 pb-2">
          <div className="truncate text-xs font-medium">
              {organizationName}
          </div>

          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Signed in
          </div>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="flex h-9 w-full items-center rounded-md px-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
