'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const reviews = items.map(toReviewViewModel);

  const hasGeneratingResponse = reviews.some(
    (review) =>
      review.generationStatus === 'queued' ||
      review.generationStatus === 'generating'
  );

  useEffect(() => {
    if (!hasGeneratingResponse) {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [hasGeneratingResponse, router]);

  const [activeTab, setActiveTab] = useState<
    'needs-response' | 'drafts' | 'all'
  >('needs-response');

  const filteredReviews = reviews.filter((review) => {
    if (activeTab === 'needs-response') {
      return review.responseStatus === 'unanswered';
    }

    if (activeTab === 'drafts') {
      return review.responseStatus === 'draft';
    }

    return true;
  });

  const [selectedId, setSelectedId] = useState(
    filteredReviews[0]?.id
  );

  const selectedReview =
    filteredReviews.find((review) => review.id === selectedId) ??
    filteredReviews[0];

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
              <button
                type="button"
                onClick={() => setActiveTab('needs-response')}
                className={[
                  'text-xs',
                  activeTab === 'needs-response'
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                ].join(' ')}
              >
                Needs response
                <span className="ml-1.5 text-muted-foreground">
                  {needsResponseCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('drafts')}
                className={[
                  'text-xs',
                  activeTab === 'drafts'
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                ].join(' ')}
              >
                Drafts
                <span className="ml-1.5 text-muted-foreground">
                  {draftCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={[
                  'text-xs',
                  activeTab === 'all'
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                ].join(' ')}
              >
                All
                <span className="ml-1.5 text-muted-foreground">
                  {reviews.length}
                </span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredReviews.length > 0 ? (
                filteredReviews.map((review) => (
                  <ReviewListItem
                    key={review.id}
                    review={review}
                    selected={review.id === selectedReview?.id}
                    onSelect={() => setSelectedId(review.id)}
                  />
                ))
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="text-xs font-medium">
                    {activeTab === 'needs-response'
                      ? 'No reviews need a response'
                      : 'No drafts yet'}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                    {activeTab === 'needs-response'
                      ? 'You’re all caught up.'
                      : 'Generated or saved drafts will appear here.'}
                  </p>
                </div>
              )}
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
