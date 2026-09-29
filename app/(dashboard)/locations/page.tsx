import {
  Building2,
  CheckCircle2,
  CircleAlert,
  MessageSquareText,
  Plus,
  RefreshCw
} from 'lucide-react';
import { redirect } from 'next/navigation';
import { getLocations } from '@/lib/api/server';
import {
  createLocation,
  syncLocationReviews
} from './actions';

type LocationsPageProps = {
  searchParams: Promise<{
    google?: string;
  }>;
};

const googleConnectionMessages: Record<
  string,
  {
    title: string;
    description: string;
  }
> = {
  connected: {
    title: 'Google connected',
    description:
      'Your Google Business Profile connection is ready.'
  },
  'authorization-cancelled': {
    title: 'Google connection cancelled',
    description:
      'No changes were made to your Google connection.'
  },
  'missing-refresh-token': {
    title: 'Google connection incomplete',
    description:
      'Google did not provide the authorization needed for background access. Please try connecting again.'
  },
  'no-accounts': {
    title: 'No Google Business Profile found',
    description:
      'The selected Google account does not have an accessible Business Profile account.'
  },
  'multiple-accounts': {
    title: 'Multiple Google accounts found',
    description:
      'Account selection is not available yet. No connection was changed.'
  },
  'connection-failed': {
    title: 'Google connection failed',
    description:
      'Revo could not complete the Google connection. Please try again.'
  },
  'account-mismatch': {
    title: 'Different Google account selected',
    description:
      'Reconnect using the Google account originally linked to this location. No connection was changed.'
  }
};

function formatSyncTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default async function LocationsPage({
  searchParams
}: LocationsPageProps) {
  const data = await getLocations();

  if (!data) {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const googleStatus = params.google
    ? googleConnectionMessages[params.google]
    : null;

  const organizationLocations =
    data.locations;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="border-b px-6 py-5">
        <h1 className="text-lg font-semibold tracking-[-0.025em]">
          Locations
        </h1>

        <p className="mt-1 text-xs text-muted-foreground">
          Manage the business locations in your Revo workspace.
        </p>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {googleStatus ? (
          <div className="mb-6 rounded-lg border bg-surface px-4 py-3">
            <div className="flex items-start gap-2.5">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

              <div>
                <p className="text-xs font-medium">
                  {googleStatus.title}
                </p>

                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {googleStatus.description}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">
                Business locations
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Review activity and provider status for each location.
              </p>
            </div>

            <span className="text-xs text-muted-foreground">
              {organizationLocations.length}{' '}
              {organizationLocations.length === 1
                ? 'location'
                : 'locations'}
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border bg-surface">
            {organizationLocations.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Building2 className="mx-auto h-4 w-4 text-muted-foreground" />

                <p className="mt-3 text-sm font-medium">
                  No locations yet
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Add your first business location below.
                </p>
              </div>
            ) : (
              organizationLocations.map((location) => {
                const hasProviderConnection =
                  Boolean(location.provider) &&
                  Boolean(location.externalId) &&
                  Boolean(location.providerConnectionId);

                const connected =
                  hasProviderConnection &&
                  location.providerConnectionStatus === 'connected';

                const needsReauth =
                  hasProviderConnection &&
                  location.providerConnectionStatus === 'needs_reauth';

                return (
                  <div
                    key={location.id}
                    className="px-5 py-4 [&:not(:last-child)]:border-b"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium">
                            {location.name}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {connected ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                Connected to {location.provider}
                              </>
                            ) : needsReauth ? (
                              <>
                                <CircleAlert className="h-3 w-3" />
                                Google connection needs attention
                              </>
                            ) : (
                              <>
                                <CircleAlert className="h-3 w-3" />
                                Not connected
                              </>
                            )}
                          </div>

                          {connected ? (
                            <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
                              {location.lastSyncError ? (
                                <>
                                  <span>Last sync failed</span>
                                  {location.lastSyncAttemptAt ? (
                                    <>
                                      {' · '}
                                      {formatSyncTime(location.lastSyncAttemptAt)}
                                    </>
                                  ) : null}
                                </>
                              ) : location.lastSyncedAt ? (
                                <>
                                  Last synced{' '}
                                  {formatSyncTime(location.lastSyncedAt)}
                                </>
                              ) : (
                                'Not synced yet'
                              )}
                            </div>
                          ) : null}

                          {connected && location.lastSyncError ? (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              Revo couldn't complete the latest review sync.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-5">
                        {connected ? (
                          <form action={syncLocationReviews}>
                            <input
                              type="hidden"
                              name="locationId"
                              value={location.id}
                            />

                            <button
                              type="submit"
                              className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-[11px] font-medium transition-colors hover:bg-muted"
                            >
                              <RefreshCw className="h-3 w-3" />
                              {location.lastSyncError
                                ? 'Retry sync'
                                : 'Sync reviews'}
                            </button>
                          </form>
                        ) : needsReauth ? (
                          <a
                            href={`/api/integrations/google/connect?mode=reconnect&connectionId=${location.providerConnectionId}`}
                            className="flex h-8 items-center rounded-md border bg-background px-2.5 text-[11px] font-medium transition-colors hover:bg-muted"
                          >
                            Reconnect Google
                          </a>
                        ) : null}

                        <div className="grid grid-cols-3 gap-6 text-right">
                          <div>
                            <div className="text-[13px] font-medium">
                              {location.reviewCount}
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              Reviews
                            </div>
                          </div>

                          <div>
                            <div className="text-[13px] font-medium">
                              {location.needsResponseCount}
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              Needs response
                            </div>
                          </div>

                          <div>
                            <div className="text-[13px] font-medium">
                              {location.respondedCount}
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              Responded
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
            <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              A review needs a response until a response draft exists in
              Revo.
            </p>
          </div>
        </section>

        <section className="mt-8 border-t pt-8">
          <div className="max-w-md">
            <h2 className="text-sm font-semibold">
              Add location
            </h2>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Add a local workspace location now. Google Business Profile
              synchronization can be connected later.
            </p>

            <form action={createLocation} className="mt-4 flex gap-2">
              <input
                type="text"
                name="name"
                required
                minLength={2}
                maxLength={160}
                placeholder="e.g. Darmstadt"
                className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
              />

              <button
                type="submit"
                className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
