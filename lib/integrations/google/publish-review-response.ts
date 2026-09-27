const GOOGLE_BUSINESS_API_BASE =
  'https://mybusiness.googleapis.com/v4';

export type PublishGoogleReviewResponseInput = {
  accessToken: string;
  accountId: string;
  locationId: string;
  reviewId: string;
  content: string;
};

function normalizeResourceId(
  value: string,
  prefix: 'accounts/' | 'locations/' | 'reviews/'
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      `Google ${prefix.slice(0, -1)} ID is required`
    );
  }

  return normalized.startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized;
}

export async function publishGoogleReviewResponse({
  accessToken,
  accountId,
  locationId,
  reviewId,
  content
}: PublishGoogleReviewResponseInput) {
  const normalizedAccessToken = accessToken.trim();
  const normalizedContent = content.trim();

  if (!normalizedAccessToken) {
    throw new Error('Google access token is required');
  }

  if (!normalizedContent) {
    throw new Error('Review response cannot be empty');
  }

  const normalizedAccountId = normalizeResourceId(
    accountId,
    'accounts/'
  );

  const normalizedLocationId = normalizeResourceId(
    locationId,
    'locations/'
  );

  const normalizedReviewId = normalizeResourceId(
    reviewId,
    'reviews/'
  );

  const url =
    `${GOOGLE_BUSINESS_API_BASE}/accounts/` +
    `${encodeURIComponent(normalizedAccountId)}/locations/` +
    `${encodeURIComponent(normalizedLocationId)}/reviews/` +
    `${encodeURIComponent(normalizedReviewId)}/reply`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${normalizedAccessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      comment: normalizedContent
    }),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(
      `Google review reply request failed with status ${response.status}`
    );
  }
}
