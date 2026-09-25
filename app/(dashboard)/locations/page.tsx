import { Building2, Plus } from 'lucide-react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { locations } from '@/lib/db/schema';
import { getOrganizationForUser } from '@/lib/db/queries';
import { createLocation } from './actions';

export default async function LocationsPage() {
  const membership = await getOrganizationForUser();

  if (!membership) {
    redirect('/sign-in');
  }

  const organizationLocations = await db
    .select()
    .from(locations)
    .where(
      eq(
        locations.organizationId,
        membership.organization.id
      )
    )
    .orderBy(locations.createdAt);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="border-b px-6 py-5">
        <h1 className="text-lg font-semibold tracking-[-0.025em]">
          Locations
        </h1>

        <p className="mt-1 text-xs text-muted-foreground">
          Manage the business locations connected to Revo.
        </p>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Business locations
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Reviews and responses are scoped to a location.
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
              <div className="px-5 py-8 text-center">
                <Building2 className="mx-auto h-4 w-4 text-muted-foreground" />

                <p className="mt-3 text-sm font-medium">
                  No locations yet
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Add your first business location below.
                </p>
              </div>
            ) : (
              organizationLocations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">
                      {location.name}
                    </div>

                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {location.provider
                        ? `Connected to ${location.provider}`
                        : 'Not connected'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-8 border-t pt-8">
          <div className="max-w-md">
            <h2 className="text-sm font-semibold">
              Add location
            </h2>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Google Business Profile connection will be added later.
              For now, create the location in your Revo workspace.
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
