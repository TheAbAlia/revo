'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Revo application error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-full border">
          <span className="text-lg font-medium">!</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          Revo is temporarily unavailable
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          We&apos;re experiencing a technical issue and are working
          to get things back to normal. Your data is safe.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Try again
        </button>

        <p className="mt-4 text-xs text-muted-foreground">
          Please try again in a moment.
        </p>
      </div>
    </main>
  );
}
