import 'server-only';

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

export function createGoogleAuthorizationUrl(state: string): URL {
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

  return url;
}
