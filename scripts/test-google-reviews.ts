import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchGoogleReviews } from '@/lib/integrations/google/fetch-reviews';

test('fetchGoogleReviews fetches and combines paginated reviews', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{
    url: URL;
    authorization: string | null;
  }> = [];

  let callCount = 0;

  globalThis.fetch = async (input, init) => {
    callCount += 1;

    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    );

    const headers = new Headers(init?.headers);

    requests.push({
      url,
      authorization: headers.get('Authorization'),
    });

    if (callCount === 1) {
      return Response.json({
        reviews: [
          {
            reviewId: 'review-1',
            starRating: 'FIVE',
            createTime: '2026-09-01T10:00:00Z',
          },
        ],
        nextPageToken: 'page-2',
      });
    }

    return Response.json({
      reviews: [
        {
          reviewId: 'review-2',
          starRating: 'FOUR',
          createTime: '2026-09-02T10:00:00Z',
        },
      ],
    });
  };

  try {
    const reviews = await fetchGoogleReviews({
      accessToken: 'test-access-token',
      accountId: 'accounts/account-123',
      locationId: 'locations/location-456',
    });

    assert.equal(reviews.length, 2);
    assert.equal(reviews[0]?.reviewId, 'review-1');
    assert.equal(reviews[1]?.reviewId, 'review-2');

    assert.equal(requests.length, 2);

    assert.equal(
      requests[0]?.authorization,
      'Bearer test-access-token'
    );

    assert.equal(
      requests[0]?.url.searchParams.get('pageSize'),
      '50'
    );

    assert.equal(
      requests[0]?.url.searchParams.get('pageToken'),
      null
    );

    assert.equal(
      requests[1]?.url.searchParams.get('pageToken'),
      'page-2'
    );

    assert.equal(
      requests[0]?.url.pathname,
      '/v4/accounts/account-123/locations/location-456/reviews'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchGoogleReviews rejects failed Google responses', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response('Forbidden', {
      status: 403,
    });

  try {
    await assert.rejects(
      () =>
        fetchGoogleReviews({
          accessToken: 'test-access-token',
          accountId: 'account-123',
          locationId: 'location-456',
        }),
      /Google reviews request failed with status 403/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
