import assert from 'node:assert/strict';
import { publishGoogleReviewResponse } from '../lib/integrations/google/publish-review-response';

async function testSuccessfulPublish() {
  const originalFetch = globalThis.fetch;

  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    capturedUrl =
      input instanceof Request ? input.url : input.toString();
    capturedInit = init;

    return new Response(
      JSON.stringify({
        updateTime: '2026-09-27T12:00:00Z'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  };

  try {
    const result = await publishGoogleReviewResponse({
      accessToken: 'test-access-token',
      accountId: 'accounts/account-123',
      locationId: 'locations/location-456',
      reviewId: 'reviews/review-789',
      content: '  Thank you for your review!  '
    });

    assert.equal(
      capturedUrl,
      'https://mybusiness.googleapis.com/v4/accounts/' +
        'account-123/locations/location-456/reviews/review-789/reply'
    );

    assert.equal(capturedInit?.method, 'PUT');

    const headers = new Headers(capturedInit?.headers);

    assert.equal(
      headers.get('Authorization'),
      'Bearer test-access-token'
    );

    assert.equal(
      headers.get('Content-Type'),
      'application/json'
    );

    assert.equal(
      capturedInit?.body,
      JSON.stringify({
        comment: 'Thank you for your review!'
      })
    );

    assert.equal(result, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testFailedPublish() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response('Forbidden', {
      status: 403
    });

  try {
    await assert.rejects(
      () =>
        publishGoogleReviewResponse({
          accessToken: 'test-access-token',
          accountId: 'account-123',
          locationId: 'location-456',
          reviewId: 'review-789',
          content: 'Thank you!'
        }),
      /Google review reply request failed with status 403/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  await testSuccessfulPublish();
  await testFailedPublish();

  console.log('Google publish response tests passed: 2/2');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
