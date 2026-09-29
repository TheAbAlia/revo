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
export type LocationListItem = {
  id: number;
  name: string;
  provider: string | null;
  externalId: string | null;
  providerConnectionId: number | null;
  providerConnectionStatus: string | null;
  lastSyncAttemptAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  reviewCount: number;
  needsResponseCount: number;
  respondedCount: number;
};

export async function getLocations() {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return null;
  }

  const response = await fetch(
    `${API_URL}/v1/locations`,
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
      'Could not load locations'
    );
  }

  return (await response.json()) as {
    locations: LocationListItem[];
  };
}

export async function createLocation(
  name: string
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
    `${API_URL}/v1/locations`,
    {
      method: 'POST',
      headers: {
        cookie: `session=${session}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ name }),
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
      error: 'Invalid location name'
    };
  }

  if (!response.ok) {
    return {
      success: false as const,
      error: 'Could not create location'
    };
  }

  return {
    success: true as const
  };
}

export async function syncLocationReviews(
  locationId: string
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
    `${API_URL}/v1/locations/${encodeURIComponent(locationId)}/sync`,
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

  if (
    response.status === 400 ||
    response.status === 404 ||
    response.status === 409
  ) {
    const body = await response
      .json()
      .catch(() => null);

    return {
      success: false as const,
      error:
        body &&
        typeof body.error === 'string'
          ? body.error
          : 'Could not sync location'
    };
  }

  if (!response.ok) {
    return {
      success: false as const,
      error: 'Could not sync location'
    };
  }

  return {
    success: true as const
  };
}

export async function getGoogleProviderConnection(
  connectionId: number
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
    `${API_URL}/v1/provider-connections/google/${encodeURIComponent(String(connectionId))}`,
    {
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
      error: 'Not found'
    };
  }

  if (!response.ok) {
    return {
      success: false as const,
      error: 'Could not load provider connection'
    };
  }

  const body = (await response.json()) as {
    connection: {
      id: number;
      externalAccountId: string;
    };
  };

  return {
    success: true as const,
    connection: body.connection
  };
}

export async function saveGoogleProviderConnection(
  externalAccountId: string,
  refreshToken: string
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
    `${API_URL}/v1/provider-connections/google`,
    {
      method: 'POST',
      headers: {
        cookie: `session=${session}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        externalAccountId,
        refreshToken
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

  if (!response.ok) {
    return {
      success: false as const,
      error: 'Could not save provider connection'
    };
  }

  return {
    success: true as const
  };
}

export async function getBrandVoice() {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  const response = await fetch(
    `${API_URL}/v1/brand-voice`,
    {
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
      error: 'Could not load brand voice'
    };
  }

  const body = (await response.json()) as {
    organization: {
      id: number;
      name: string;
    };
    brandVoice: {
      name: string;
      instructions: string;
    } | null;
  };

  return {
    success: true as const,
    organization: body.organization,
    brandVoice: body.brandVoice
  };
}

export async function saveBrandVoice(
  name: string,
  instructions: string
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
    `${API_URL}/v1/brand-voice`,
    {
      method: 'PUT',
      headers: {
        cookie: `session=${session}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        name,
        instructions
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
    const body = await response
      .json()
      .catch(() => null);

    return {
      success: false as const,
      error:
        body &&
        typeof body.error === 'string'
          ? body.error
          : 'Could not save brand voice'
    };
  }

  if (!response.ok) {
    return {
      success: false as const,
      error: 'Could not save brand voice'
    };
  }

  return {
    success: true as const
  };
}

export async function getAutomations() {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  const response = await fetch(
    `${API_URL}/v1/automations`,
    {
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
      error: 'Could not load automations'
    };
  }

  const body = (await response.json()) as {
    settings: {
      autoGenerateDrafts: boolean;
    };
  };

  return {
    success: true as const,
    settings: body.settings
  };
}

export async function saveAutomations(
  autoGenerateDrafts: boolean
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
    `${API_URL}/v1/automations`,
    {
      method: 'PUT',
      headers: {
        cookie: `session=${session}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        autoGenerateDrafts
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

  if (!response.ok) {
    return {
      success: false as const,
      error: 'Could not save automations'
    };
  }

  return {
    success: true as const
  };
}

export async function getAnalytics() {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  const response = await fetch(
    `${API_URL}/v1/analytics`,
    {
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
      error: 'Could not load analytics'
    };
  }

  const body = (await response.json()) as {
    analytics: {
      totalReviews: number;
      averageRating: number;
      respondedReviews: number;
      needsResponse: number;
      responseCoverage: number;
      ratingDistribution: Array<{
        rating: number;
        count: number;
      }>;
      locations: Array<{
        id: number;
        name: string;
        totalReviews: number;
        averageRating: number;
        respondedReviews: number;
      }>;
    };
  };

  return {
    success: true as const,
    analytics: body.analytics
  };
}

export async function getSettings() {
  const session =
    (await cookies()).get('session')?.value;

  if (!session) {
    return {
      success: false as const,
      error: 'Unauthorized'
    };
  }

  const response = await fetch(
    `${API_URL}/v1/settings`,
    {
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
      error: 'Could not load settings'
    };
  }

  const body = (await response.json()) as {
    settings: {
      user: {
        id: number;
        name: string | null;
        email: string;
      };
      organization: {
        id: number;
        name: string;
      };
      role: string;
    };
  };

  return {
    success: true as const,
    settings: body.settings
  };
}

export async function saveSettingsAccount(
  name: string,
  email: string
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
    `${API_URL}/v1/settings/account`,
    {
      method: 'PUT',
      headers: {
        cookie: `session=${session}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        name,
        email
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

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => null);

    return {
      success: false as const,
      error:
        body &&
        typeof body.error === 'string'
          ? body.error
          : 'Could not update account'
    };
  }

  return {
    success: true as const
  };
}

export async function saveSettingsPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
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
    `${API_URL}/v1/settings/password`,
    {
      method: 'PUT',
      headers: {
        cookie: `session=${session}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword
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

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => null);

    return {
      success: false as const,
      error:
        body &&
        typeof body.error === 'string'
          ? body.error
          : 'Could not update password'
    };
  }

  return {
    success: true as const
  };
}
