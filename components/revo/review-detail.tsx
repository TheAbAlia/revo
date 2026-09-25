import type { Review } from '@/lib/mock/reviews';
import { MoreHorizontal, Star } from 'lucide-react';
import { ResponseEditor } from './response-editor';

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={[
            'h-3.5 w-3.5',
            index < rating
              ? 'fill-foreground text-foreground'
              : 'text-border-strong'
          ].join(' ')}
        />
      ))}
    </div>
  );
}

export function ReviewDetail({
  review
}: {
  review: Review;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
        <div>
          <span className="text-[13px] font-semibold">
            {review.author}
          </span>

          <span className="ml-2 text-[11px] text-muted-foreground">
            {review.createdAt}
          </span>
        </div>

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Review actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <section className="px-6 py-6">
          <div className="flex items-center gap-3">
            <Stars rating={review.rating} />

            <span className="text-[11px] text-muted-foreground">
              {review.platform} · {review.location}
            </span>
          </div>

          <p className="mt-5 max-w-2xl text-[14px] leading-7">
            {review.content}
          </p>
        </section>

        <div className="border-t">
          <div className="px-6 pb-2 pt-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Your response
            </div>
          </div>

          <div className="mx-6 mb-6 overflow-hidden rounded-lg border bg-surface">
            <ResponseEditor />
          </div>
        </div>
      </div>
    </div>
  );
}
