'use client';

import { useState } from 'react';
import {
  Building2,
  Filter,
  SlidersHorizontal
} from 'lucide-react';
import Link from 'next/link';
import type { ReviewWithResponse } from '@/lib/domain/reviews';
import { toReviewViewModel } from '@/lib/reviews/view-model';
import { ReviewListItem } from './review-list-item';
import { ReviewDetail } from './review-detail';

export function ReviewInbox({
  items
}: {
  items: ReviewWithResponse[];
}) {
  const reviews = items.map(toReviewViewModel);

  const [selectedId, setSelectedId] = useState(reviews[0]?.id);

  const selectedReview =
    reviews.find((review) => review.id === selectedId) ?? reviews[0];

  const needsResponseCount = reviews.filter(
    (review) => review.responseStatus === 'unanswered'
  ).length;

  const draftCount = reviews.filter(
    (review) => review.responseStatus === 'draft'
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b bg-background px-6 py-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.025em]">
              Review Inbox
            </h1>

            <p className="mt-1 text-xs text-muted-foreground">
              Manage and respond to customer reviews.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-md border bg-surface px-3 text-xs font-medium hover:bg-muted"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>

            <button
              type="button"
              aria-label="Inbox options"
              className="flex h-8 w-8 items-center justify-center rounded-md border bg-surface hover:bg-muted"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {reviews.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border bg-surface">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>

            <h2 className="mt-4 text-sm font-semibold">
              Connect your first location
            </h2>

            <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
              Add a business location to prepare your workspace for customer
              reviews.
            </p>

            <Link
              href="/locations"
              className="mt-5 inline-flex h-8 items-center rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
            >
              Add location
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <section className="flex w-[380px] shrink-0 flex-col border-r bg-background">
            <div className="flex h-11 shrink-0 items-center gap-4 border-b px-4">
              <button className="text-xs font-medium">
                Needs response
                <span className="ml-1.5 text-muted-foreground">
                  {needsResponseCount}
                </span>
              </button>

              <button className="text-xs text-muted-foreground hover:text-foreground">
                Drafts
                <span className="ml-1.5">
                  {draftCount}
                </span>
              </button>

              <button className="text-xs text-muted-foreground hover:text-foreground">
                All
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {reviews.map((review) => (
                <ReviewListItem
                  key={review.id}
                  review={review}
                  selected={review.id === selectedReview?.id}
                  onSelect={() => setSelectedId(review.id)}
                />
              ))}
            </div>
          </section>

          <section className="min-w-0 flex-1 bg-background">
            {selectedReview && (
              <ReviewDetail review={selectedReview} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
