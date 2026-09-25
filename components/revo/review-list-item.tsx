import type { Review } from '@/lib/mock/reviews';
import { Check, MessageSquareText, Star } from 'lucide-react';

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-px">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={[
            'h-3 w-3',
            index < rating
              ? 'fill-foreground text-foreground'
              : 'text-border-strong'
          ].join(' ')}
        />
      ))}
    </div>
  );
}

export function ReviewListItem({
  review,
  selected,
  onSelect
}: {
  review: Review;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full border-b px-4 py-4 text-left transition-colors',
        selected
          ? 'bg-muted'
          : 'bg-background hover:bg-muted/60'
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-[10px] font-semibold">
          {review.initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-[13px] font-semibold">
              {review.author}
            </span>

            <span className="shrink-0 text-[11px] text-muted-foreground">
              {review.createdAt}
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Stars rating={review.rating} />

            {review.status === 'draft' && (
              <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
            )}

            {review.status === 'published' && (
              <Check className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>

          <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {review.content}
          </p>

          <div className="mt-3 text-[10px] text-muted-foreground">
            {review.platform} · {review.location}
          </div>
        </div>
      </div>
    </button>
  );
}
