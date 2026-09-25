import { Command, Search } from 'lucide-react';

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center border-b bg-surface px-6">
      <div className="flex-1" />

      <button className="flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>

        <span className="ml-4 flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px]">
          <Command className="h-2.5 w-2.5" />K
        </span>
      </button>
    </header>
  );
}
