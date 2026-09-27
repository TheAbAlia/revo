'use client';

import { useActionState } from 'react';
import {
  saveDefaultBrandVoice,
  type BrandVoiceActionState
} from '@/lib/brand-voice/actions';

const initialState: BrandVoiceActionState = {};

export function BrandVoiceForm({
  name,
  instructions
}: {
  name: string;
  instructions: string;
}) {
  const [state, formAction, isPending] = useActionState(
    saveDefaultBrandVoice,
    initialState
  );

  return (
    <form action={formAction} className="mt-6 max-w-2xl">
      <div>
        <label
          htmlFor="name"
          className="text-xs font-medium"
        >
          Voice name
        </label>

        <input
          id="name"
          name="name"
          type="text"
          maxLength={100}
          required
          defaultValue={name}
          className="mt-2 h-9 w-full rounded-md border bg-surface px-3 text-[13px] outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="mt-5">
        <label
          htmlFor="instructions"
          className="text-xs font-medium"
        >
          Instructions
        </label>

        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Describe how Revo should sound when responding to reviews.
        </p>

        <textarea
          id="instructions"
          name="instructions"
          maxLength={4000}
          required
          defaultValue={instructions}
          placeholder="Warm, professional, concise, and specific to the customer review."
          className="mt-2 min-h-[180px] w-full resize-y rounded-md border bg-surface px-3 py-3 text-[13px] leading-6 outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {state.error && (
        <p className="mt-3 text-xs text-destructive">
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="mt-3 text-xs text-muted-foreground">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 flex h-8 items-center rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  );
}
