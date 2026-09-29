import 'server-only';

import { cookies } from 'next/headers';

import type { ReviewWithResponse } from '@/lib/domain/reviews';

const API_URL =
  process.env.REVO_API_URL ?? 'http://127.0.0.1:4000';

type DashboardShell = {
  organization: {
    id: number;
    name: string;
  };
  inboxCount: number;
};

export async function getDashboardShell(): Promise<
  DashboardShell | null
> {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return null;
  }

  const response = await fetch(
    `${API_URL}/v1/dashboard/shell`,
    {
      headers: {
        cookie: `session=${session}`
      },
      cache: 'no-store'
    }
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Revo API request failed with status ${response.status}`
    );
  }

  return response.json() as Promise<DashboardShell>;
}

export async function getReviewInbox(): Promise<
  ReviewWithResponse[] | null
> {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return null;
  }

  const response = await fetch(
    `${API_URL}/v1/reviews`,
    {
      headers: {
        cookie: `session=${session}`
      },
      cache: 'no-store'
    }
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Revo API request failed with status ${response.status}`
    );
  }

  const body = (await response.json()) as {
    items: ReviewWithResponse[];
  };

  return body.items;
}

export async function generateReviewResponse(
  reviewId: string
) {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  const response = await fetch(
    `${API_URL}/v1/reviews/${encodeURIComponent(reviewId)}/generate`,
    {
      method: 'POST',
      headers: {
        cookie: `session=${session}`
      },
      cache: 'no-store'
    }
  );

  if (response.status === 401) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  if (!response.ok) {
    return {
      success: false as const,
      error:
        'Could not start response generation. Please try again.'
    };
  }

  return {
    success: true as const
  };
}

export async function retryReviewResponseGeneration(
  reviewId: string
) {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  const response = await fetch(
    `${API_URL}/v1/reviews/${encodeURIComponent(reviewId)}/generate/retry`,
    {
      method: 'POST',
      headers: {
        cookie: `session=${session}`
      },
      cache: 'no-store'
    }
  );

  if (response.status === 401) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  if (response.status === 409) {
    return {
      success: false as const,
      error:
        'There is no failed generation to retry.'
    };
  }

  if (!response.ok) {
    return {
      success: false as const,
      error:
        'Could not retry response generation. Please try again.'
    };
  }

  return {
    success: true as const
  };
}

export async function saveReviewResponseDraft(
  reviewId: string,
  content: string
) {
  return mutateReviewResponse(
    reviewId,
    '/response',
    'PUT',
    content
  );
}

export async function approveReviewResponse(
  reviewId: string,
  content: string
) {
  return mutateReviewResponse(
    reviewId,
    '/response/approve',
    'POST',
    content
  );
}

async function mutateReviewResponse(
  reviewId: string,
  suffix: string,
  method: 'PUT' | 'POST',
  content: string
) {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  const response = await fetch(
    `${API_URL}/v1/reviews/${encodeURIComponent(reviewId)}${suffix}`,
    {
      method,
      headers: {
        cookie: `session=${session}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        content
      }),
      cache: 'no-store'
    }
  );

  if (response.status === 401) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  if (response.status === 400) {
    return {
      success: false as const,
      error: 'Response cannot be empty'
    };
  }

  if (response.status === 404) {
    return {
      success: false as const,
      error: 'Response not found'
    };
  }

  if (!response.ok) {
    return {
      success: false as const,
      error:
        'Could not update response. Please try again.'
    };
  }

  return {
    success: true as const
  };
}

export async function publishReviewResponse(
  reviewId: string
) {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  const response = await fetch(
    `${API_URL}/v1/reviews/${encodeURIComponent(reviewId)}/response/publish`,
    {
      method: 'POST',
      headers: {
        cookie: `session=${session}`
      },
      cache: 'no-store'
    }
  );

  if (response.status === 401) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  if (response.status === 404) {
    return {
      success: false as const,
      error: 'Response not found'
    };
  }

  if (response.status === 409) {
    const body = await response
      .json()
      .catch(() => null);

    return {
      success: false as const,
      error:
        body &&
        typeof body.error === 'string'
          ? body.error
          : 'Response cannot be published'
    };
  }

  if (!response.ok) {
    return {
      success: false as const,
      error:
        'Could not publish response. Please try again.'
    };
  }

  return {
    success: true as const
  };
}

