import {
  Building2,
  CheckCircle2,
  CircleAlert,
  MessageSquareText,
  Plus
} from 'lucide-react';
import { redirect } from 'next/navigation';
import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { locations, responses, reviews } from '@/lib/db/schema';
import { getOrganizationForUser } from '@/lib/db/queries';
import { createLocation } from './actions';

export default async function LocationsPage() {
  const membership = await getOrganizationForUser();

  if (!membership) {
    redirect('/sign-in');
  }

  const organizationId = membership.organization.id;

  const organizationLocations = await db
    .select({
      id: locations.id,
      name: locations.name,
      provider: locations.provider,
      externalId: locations.externalId,
      reviewCount: count(reviews.id),
      needsResponseCount: sql<number>`
        count(${reviews.id}) filter (
          where ${reviews.id} is not null
          and ${responses.id} is null
        )
      `,
      respondedCount: sql<number>`
        count(${responses.id})
      `
    })
    .from(locations)
    .leftJoin(
      reviews,
      and(
        eq(reviews.locationId, locations.id),
        eq(reviews.organizationId, organizationId)
      )
    )
    .leftJoin(
      responses,
      and(
        eq(responses.reviewId, reviews.id),
        eq(responses.organizationId, organizationId)
      )
    )
    .where(eq(locations.organizationId, organizationId))
    .groupBy(
      locations.id,
      locations.name,
      locations.provider,
      locations.externalId,
      locations.createdAt
    )
    .orderBy(locations.createdAt);

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
                const connected =
                  Boolean(location.provider) &&
                  Boolean(location.externalId);

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
                            ) : (
                              <>
                                <CircleAlert className="h-3 w-3" />
                                Not connected
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid shrink-0 grid-cols-3 gap-6 text-right">
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
