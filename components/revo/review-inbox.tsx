'use client';

import { Filter, SlidersHorizontal } from 'lucide-react';
import { reviews } from '@/lib/mock/reviews';
import { ReviewCard } from './review-card';

export function ReviewInbox() {
  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <div className="px-6 pb-5 pt-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.025em]">
              Review Inbox
            </h1>

            <p className="mt-1 text-[13px] text-muted-foreground">
              Manage and respond to customer reviews.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex h-8 items-center gap-2 rounded-md border bg-surface px-3 text-xs font-medium hover:bg-muted">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>

            <button className="flex h-8 w-8 items-center justify-center rounded-md border bg-surface hover:bg-muted">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-y bg-background">
        <div className="flex h-10 items-center gap-5 border-b px-6 text-xs">
          <button className="font-medium text-foreground">
            Needs response
            <span className="ml-1.5 text-muted-foreground">
              12
            </span>
          </button>

          <button className="text-muted-foreground hover:text-foreground">
            Drafts
            <span className="ml-1.5">3</span>
          </button>

          <button className="text-muted-foreground hover:text-foreground">
            Published
          </button>

          <button className="text-muted-foreground hover:text-foreground">
            All reviews
          </button>
        </div>

        <div>
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
