import type { DbExecutor } from '@/lib/db/types';
import {
  isGoogleOAuthReauthError
} from '@/lib/integrations/google/errors';
import {
  refreshGoogleAccessToken
} from '@/lib/integrations/google/oauth';
import {
  markProviderConnectionNeedsReauth
} from '@/lib/integrations/providers/connection-health';

export async function refreshGoogleProviderAccessToken(
  db: DbExecutor,
  organizationId: number,
  providerConnectionId: number,
  refreshToken: string,
  refresh: typeof refreshGoogleAccessToken =
    refreshGoogleAccessToken
) {
  try {
    return await refresh(refreshToken);
  } catch (error) {
    if (isGoogleOAuthReauthError(error)) {
      await markProviderConnectionNeedsReauth(
        db,
        organizationId,
        providerConnectionId,
        error
      );
    }

    throw error;
  }
}
