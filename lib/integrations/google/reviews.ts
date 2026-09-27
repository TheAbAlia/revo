import type {
  NormalizedProviderReview
} from '@/lib/integrations/providers/types';

export type GoogleStarRating =
  | 'STAR_RATING_UNSPECIFIED'
  | 'ONE'
  | 'TWO'
  | 'THREE'
  | 'FOUR'
  | 'FIVE';

export type GoogleReview = {
  reviewId?: string;
  reviewer?: {
    displayName?: string;
    isAnonymous?: boolean;
  };
  starRating?: GoogleStarRating;
  comment?: string;
  createTime?: string;
};

const STAR_RATING_VALUES: Record<
  Exclude<GoogleStarRating, 'STAR_RATING_UNSPECIFIED'>,
  number
> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5
};

function normalizeStarRating(
  rating: GoogleStarRating | undefined
): number {
  if (!rating || rating === 'STAR_RATING_UNSPECIFIED') {
    throw new Error('Google review has no valid star rating');
  }

  return STAR_RATING_VALUES[rating];
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'A';
}

export function normalizeGoogleReview(
  review: GoogleReview
): NormalizedProviderReview {
  const externalId = review.reviewId?.trim();

  if (!externalId) {
    throw new Error('Google review has no review ID');
  }

  const receivedAt = new Date(review.createTime ?? '');

  if (Number.isNaN(receivedAt.getTime())) {
    throw new Error('Google review has no valid creation time');
  }

  const isAnonymous = review.reviewer?.isAnonymous === true;
  const suppliedName = review.reviewer?.displayName?.trim();

  const authorName =
    !isAnonymous && suppliedName
      ? suppliedName
      : 'Anonymous';

  return {
    provider: 'google',
    externalId,
    authorName,
    authorInitials: getInitials(authorName),
    rating: normalizeStarRating(review.starRating),
    content: review.comment?.trim() ?? '',
    receivedAt
  };
}
