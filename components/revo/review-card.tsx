import type { Review } from '@/lib/mock/reviews';
import {
  Check,
  MessageSquareText,
  Sparkles,
  Star
} from 'lucide-react';

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={[
            'h-3.5 w-3.5',
            index < rating
              ? 'fill-foreground text-foreground'
              : 'fill-transparent text-border-strong'
          ].join(' ')}
        />
      ))}
    </div>
  );
}

export function ReviewCard({
  review
}: {
  review: Review;
}) {
  return (
    <article className="border-b px-6 py-5 transition-colors hover:bg-surface">
      <div className="flex gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
          {review.initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold">
                  {review.author}
                </span>

                <span className="text-xs text-muted-foreground">
                  {review.createdAt}
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <Stars rating={review.rating} />

                <span className="text-[11px] text-muted-foreground">
                  {review.platform} · {review.location}
                </span>
              </div>
            </div>

            {review.status === 'published' && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Check className="h-3.5 w-3.5" />
                Published
              </div>
            )}

            {review.status === 'draft' && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MessageSquareText className="h-3.5 w-3.5" />
                Draft ready
              </div>
            )}
          </div>

          <p className="mt-4 max-w-3xl text-[13px] leading-6 text-foreground/85">
            {review.content}
          </p>

          {review.status !== 'published' && (
            <div className="mt-4 flex items-center">
              <button className="flex h-8 items-center gap-2 rounded-md border bg-surface px-3 text-xs font-medium transition-colors hover:bg-muted">
                <Sparkles className="h-3.5 w-3.5" />

                {review.status === 'draft'
                  ? 'Review draft'
                  : 'Generate response'}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
