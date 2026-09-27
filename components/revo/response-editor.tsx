'use client';

import { useEffect, useState, useTransition } from 'react';
import type {
  ReviewResponse,
  ResponseStatus
} from '@/lib/domain/reviews';
import {
  approveResponse,
  generateResponse,
  retryResponseGeneration,
  saveResponseDraft
} from '@/lib/reviews/actions';
import {
  Check,
  ChevronDown,
  RefreshCw,
  LoaderCircle,
  Send,
  Sparkles
} from 'lucide-react';

export function ResponseEditor({
  reviewId,
  response: initialResponse,
  generationStatus,
  generationError
}: {
  reviewId: string;
  response: ReviewResponse | null;
  generationStatus:
    | 'queued'
    | 'generating'
    | 'failed'
    | null;
  generationError: string | null;
}) {
  const [content, setContent] = useState(
    initialResponse?.content ?? ''
  );

  const [status, setStatus] = useState<
    ResponseStatus | 'unanswered'
  >(initialResponse?.status ?? 'unanswered');

  useEffect(() => {
    setContent(initialResponse?.content ?? '');
    setStatus(initialResponse?.status ?? 'unanswered');
  }, [initialResponse]);

  const [isPending, startTransition] = useTransition();
  const [generationActionError, setGenerationActionError] =
    useState<string | null>(null);

  const generate = () => {
    setGenerationActionError(null);

    startTransition(async () => {
      const result = await generateResponse(reviewId);

      if (!result.success) {
        setGenerationActionError(result.error);
      }
    });
  };

  const retryGeneration = () => {
    setGenerationActionError(null);

    startTransition(async () => {
      const result = await retryResponseGeneration(reviewId);

      if (!result.success) {
        setGenerationActionError(result.error);
      }
    });
  };

  const approve = () => {
    const nextContent = content.trim();

    if (!nextContent) {
      return;
    }

    setContent(nextContent);
    setStatus('approved');

    startTransition(async () => {
      await approveResponse(reviewId, nextContent);
    });
  };

  const saveDraft = () => {
    const nextContent = content.trim();

    if (!nextContent) {
      return;
    }

    setContent(nextContent);

    startTransition(async () => {
      await saveResponseDraft(reviewId, nextContent);
    });
  };

  const generationActive =
    generationStatus === 'queued' ||
    generationStatus === 'generating';

  if (!content && generationActive) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center px-8 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-surface">
          <LoaderCircle className="h-4 w-4 animate-spin" />
        </div>

        <h3 className="mt-4 text-[13px] font-semibold">
          Generating response
        </h3>

        <p className="mt-1 max-w-[300px] text-xs leading-5 text-muted-foreground">
          Revo is preparing a draft using your brand voice and this review.
        </p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center px-8 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-surface">
          <Sparkles className="h-4 w-4" />
        </div>

        <h3 className="mt-4 text-[13px] font-semibold">
          Generate a response
        </h3>

        <p className="mt-1 max-w-[300px] text-xs leading-5 text-muted-foreground">
          Revo will create a response using your brand voice and the
          context of this review.
        </p>

        <button
          type="button"
          onClick={
            generationStatus === 'failed'
              ? retryGeneration
              : generate
          }
          disabled={isPending || generationActive}
          className="mt-5 flex h-8 items-center gap-2 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {generationStatus === 'queued'
            ? 'Queued...'
            : generationStatus === 'generating' || isPending
              ? 'Generating...'
              : generationStatus === 'failed'
                ? 'Retry generation'
                : 'Generate response'}
        </button>

        {(generationError || generationActionError) && (
          <p className="mt-3 text-xs text-destructive">
            {generationError || generationActionError}
          </p>
        )}
      </div>
    );
  }

  const published = status === 'published';

  return (
    <div>
      <div className="flex h-11 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Response</span>

          <button
            type="button"
            disabled={published}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-60"
          >
            Default voice
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {published ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Check className="h-3.5 w-3.5" />
            Published
          </span>
        ) : (
          <button
            type="button"
            onClick={generate}
            disabled={isPending || generationActive}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            {generationStatus === 'queued'
              ? 'Queued...'
              : generationStatus === 'generating' || isPending
                ? 'Generating...'
                : 'Regenerate'}
          </button>
        )}
      </div>

      {(generationError || generationActionError) && (
        <div className="border-b px-4 py-2 text-xs text-destructive">
          {generationError || generationActionError}
        </div>
      )}

      <textarea
        value={content}
        readOnly={published}
        onChange={(event) => {
          setContent(event.target.value);
          setStatus('draft');
        }}
        className={[
          'min-h-[190px] w-full resize-none bg-transparent px-4 py-4 text-[13px] leading-6 outline-none',
          published ? 'cursor-default' : ''
        ].join(' ')}
      />

      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-[11px] text-muted-foreground">
          {content.length} characters
        </span>

        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <>
              <button
                type="button"
                onClick={saveDraft}
                disabled={isPending}
                className="flex h-8 items-center rounded-md border bg-surface px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                Save draft
              </button>

              <button
                type="button"
                onClick={approve}
                disabled={isPending}
                className="flex h-8 items-center gap-2 rounded-md border bg-surface px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </button>
            </>
          )}

          {status === 'approved' && (
            <>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Check className="h-3.5 w-3.5" />
                Approved
              </span>

              <button
                type="button"
                disabled
                title="Connect Google Business Profile to publish responses"
                className="flex h-8 cursor-not-allowed items-center gap-2 rounded-md border bg-muted px-3 text-xs font-medium text-muted-foreground opacity-70"
              >
                <Send className="h-3.5 w-3.5" />
                Connect Google to publish
              </button>
            </>
          )}

          {status === 'published' && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Check className="h-3.5 w-3.5" />
              Published
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
