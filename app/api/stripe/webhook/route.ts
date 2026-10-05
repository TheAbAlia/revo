import {
  NextRequest,
  NextResponse
} from 'next/server';

const API_URL =
  process.env.REVO_API_URL ??
  'http://127.0.0.1:4000';

export async function POST(
  request: NextRequest
) {
  const signature =
    request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      {
        error: 'Missing Stripe signature'
      },
      {
        status: 400
      }
    );
  }

  const payload = await request.arrayBuffer();

  const response = await fetch(
    `${API_URL}/v1/billing/webhook`,
    {
      method: 'POST',
      headers: {
        'content-type':
          'application/octet-stream',
        'stripe-signature': signature
      },
      body: payload,
      cache: 'no-store'
    }
  );

  const body = await response
    .json()
    .catch(() => ({
      error: 'Billing webhook failed'
    }));

  return NextResponse.json(
    body,
    {
      status: response.status
    }
  );
}
