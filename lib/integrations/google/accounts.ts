import { googleHttpError } from '@/lib/integrations/google/errors';

const GOOGLE_ACCOUNT_MANAGEMENT_API_BASE =
  'https://mybusinessaccountmanagement.googleapis.com/v1';

type GoogleAccount = {
  name?: string;
  accountName?: string;
  type?: string;
  role?: string;
};

type GoogleAccountsResponse = {
  accounts?: GoogleAccount[];
};

export type GoogleBusinessAccount = {
  externalAccountId: string;
  name: string;
};

function normalizeGoogleAccountId(name: string): string {
  const normalized = name.trim();

  if (!normalized) {
    throw new Error('Google account name is required');
  }

  return normalized.startsWith('accounts/')
    ? normalized.slice('accounts/'.length)
    : normalized;
}

export async function fetchGoogleBusinessAccounts(
  accessToken: string
): Promise<GoogleBusinessAccount[]> {
  const response = await fetch(
    `${GOOGLE_ACCOUNT_MANAGEMENT_API_BASE}/accounts`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      cache: 'no-store'
    }
  );

  if (!response.ok) {
    throw googleHttpError(
      'Google account discovery request',
      response.status
    );
  }

  const data =
    (await response.json()) as GoogleAccountsResponse;

  return (data.accounts ?? []).flatMap((account) => {
    if (!account.name) {
      return [];
    }

    return [{
      externalAccountId:
        normalizeGoogleAccountId(account.name),
      name:
        account.accountName?.trim() ||
        account.name
    }];
  });
}
