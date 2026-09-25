import type {
  ReviewResponse,
  ReviewWithResponse,
  ResponseStatus
} from '@/lib/domain/reviews';

export type ReviewViewModel = {
  id: string;

  authorName: string;
  authorInitials: string;

  rating: number;
  content: string;

  providerLabel: string;
  locationLabel: string;
  receivedAtLabel: string;

  responseStatus: ResponseStatus | 'unanswered';
  response: ReviewResponse | null;
};

const providerLabels = {
  google: 'Google'
} as const;

function formatReceivedAt(receivedAt: string): string {
  const received = new Date(receivedAt);
  const now = new Date();

  const differenceMs = now.getTime() - received.getTime();
  const differenceHours = Math.floor(
    differenceMs / (1000 * 60 * 60)
  );

  if (differenceHours < 1) {
    return 'Just now';
  }

  if (differenceHours < 24) {
    return `${differenceHours}h`;
  }

  const differenceDays = Math.floor(differenceHours / 24);

  if (differenceDays === 1) {
    return 'Yesterday';
  }

  return `${differenceDays}d`;
}

export function toReviewViewModel(
  item: ReviewWithResponse
): ReviewViewModel {
  const { review, response } = item;

  return {
    id: review.id,

    authorName: review.authorName,
    authorInitials: review.authorInitials,

    rating: review.rating,
    content: review.content,

    providerLabel: providerLabels[review.provider],

    locationLabel: item.locationName,

    receivedAtLabel: formatReceivedAt(review.receivedAt),

    responseStatus: response?.status ?? 'unanswered',
    response
  };
}