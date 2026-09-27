import type { GoogleReview } from '@/lib/integrations/google/reviews';

const GOOGLE_BUSINESS_API_BASE =
  'https://mybusiness.googleapis.com/v4';

type GoogleReviewsResponse = {
  reviews?: GoogleReview[];
  nextPageToken?: string;
};

export type FetchGoogleReviewsInput = {
  accessToken: string;
  accountId: string;
  locationId: string;
};

function normalizeResourceId(
  value: string,
  prefix: 'accounts/' | 'locations/'
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Google ${prefix.slice(0, -1)} ID is required`);
  }

  return normalized.startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized;
}

export async function fetchGoogleReviews({
  accessToken,
  accountId,
  locationId,
}: FetchGoogleReviewsInput): Promise<GoogleReview[]> {
  const normalizedAccessToken = accessToken.trim();

  if (!normalizedAccessToken) {
    throw new Error('Google access token is required');
  }

  const normalizedAccountId = normalizeResourceId(
    accountId,
    'accounts/'
  );

  const normalizedLocationId = normalizeResourceId(
    locationId,
    'locations/'
  );

  const reviews: GoogleReview[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `${GOOGLE_BUSINESS_API_BASE}/accounts/` +
        `${encodeURIComponent(normalizedAccountId)}/locations/` +
        `${encodeURIComponent(normalizedLocationId)}/reviews`
    );

    url.searchParams.set('pageSize', '50');

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${normalizedAccessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(
        `Google reviews request failed with status ${response.status}`
      );
    }

    const data = (await response.json()) as GoogleReviewsResponse;

    reviews.push(...(data.reviews ?? []));

    pageToken = data.nextPageToken?.trim() || undefined;
  } while (pageToken);

  return reviews;
}
