import { googleOAuthError } from '@/lib/integrations/google/errors';

export const GOOGLE_BUSINESS_SCOPE =
  'https://www.googleapis.com/auth/business.manage';

const GOOGLE_AUTHORIZATION_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth';

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }

  return value;
}

export function getGoogleOAuthConfig() {
  return {
    clientId: requireEnvironmentVariable('GOOGLE_CLIENT_ID'),
    redirectUri: requireEnvironmentVariable(
      'GOOGLE_OAUTH_REDIRECT_URI'
    ),
  };
}

export function getGoogleOAuthTokenConfig() {
  return {
    ...getGoogleOAuthConfig(),
    clientSecret: requireEnvironmentVariable(
      'GOOGLE_CLIENT_SECRET'
    ),
  };
}

export function createGoogleAuthorizationUrl(
  state: string,
  options: {
    promptForConsent?: boolean;
  } = {}
): URL {
  if (!state) {
    throw new Error('OAuth state is required');
  }

  const { clientId, redirectUri } = getGoogleOAuthConfig();

  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);

  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_BUSINESS_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);

  if (options.promptForConsent) {
    url.searchParams.set('prompt', 'consent');
  }

  return url;
}

const GOOGLE_TOKEN_ENDPOINT =
  'https://oauth2.googleapis.com/token';

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleAuthorizationCode(
  code: string
) {
  const normalizedCode = code.trim();

  if (!normalizedCode) {
    throw new Error('Google authorization code is required');
  }

  const { clientId, clientSecret, redirectUri } =
    getGoogleOAuthTokenConfig();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: normalizedCode,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });

  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok) {
    throw googleOAuthError(
      'Google token exchange',
      data.error,
      data.error_description
    );
  }

  if (!data.access_token) {
    throw new Error(
      'Google token exchange returned no access token'
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
    scope: data.scope ?? null,
    tokenType: data.token_type ?? null,
  };
}

export async function refreshGoogleAccessToken(
  refreshToken: string
) {
  const normalizedRefreshToken = refreshToken.trim();

  if (!normalizedRefreshToken) {
    throw new Error('Google refresh token is required');
  }

  const { clientId, clientSecret } =
    getGoogleOAuthTokenConfig();

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: normalizedRefreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });

  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok) {
    throw googleOAuthError(
      'Google access token refresh',
      data.error,
      data.error_description
    );
  }

  if (!data.access_token) {
    throw new Error(
      'Google token refresh returned no access token'
    );
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? null,
    scope: data.scope ?? null,
    tokenType: data.token_type ?? null,
  };
}
