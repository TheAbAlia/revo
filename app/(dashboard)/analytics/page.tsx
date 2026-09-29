import { redirect } from 'next/navigation';
import { Star } from 'lucide-react';
import { getAnalytics } from '@/lib/api/server';

function formatRating(value: number) {
  return value === 0 ? '—' : value.toFixed(1);
}

export default async function AnalyticsPage() {
  const result = await getAnalytics();

  if (!result.success) {
    if (result.error === 'Unauthorized') {
      redirect('/sign-in');
    }

    throw new Error(result.error);
  }

  const analytics = result.analytics;

  const ratingCounts = new Map(
    analytics.ratingDistribution.map((item) => [
      item.rating,
      item.count
    ])
  );

  return (
    <div className="h-full overflow-y-auto bg-background">
      <header className="border-b px-6 py-5">
        <h1 className="text-lg font-semibold tracking-[-0.025em]">
          Analytics
        </h1>

        <p className="mt-1 text-xs text-muted-foreground">
          Review performance across your Revo workspace.
        </p>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <section className="grid grid-cols-4 overflow-hidden rounded-lg border bg-surface">
          {[
            {
              label: 'Average rating',
              value: formatRating(analytics.averageRating)
            },
            {
              label: 'Total reviews',
              value: analytics.totalReviews
            },
            {
              label: 'Response coverage',
              value: `${Math.round(analytics.responseCoverage)}%`
            },
            {
              label: 'Needs response',
              value: analytics.needsResponse
            }
          ].map((metric, index) => (
            <div
              key={metric.label}
              className={[
                'px-5 py-4',
                index > 0 ? 'border-l' : ''
              ].join(' ')}
            >
              <div className="text-[11px] text-muted-foreground">
                {metric.label}
              </div>

              <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                {metric.value}
              </div>
            </div>
          ))}
        </section>

        <div className="mt-8 grid grid-cols-[1fr_1.4fr] gap-6">
          <section>
            <h2 className="text-sm font-semibold">
              Rating distribution
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Reviews grouped by star rating.
            </p>

            <div className="mt-4 rounded-lg border bg-surface px-5 py-4">
              {[5, 4, 3, 2, 1].map((rating) => {
                const value = ratingCounts.get(rating) ?? 0;
                const percentage =
                  analytics.totalReviews === 0
                    ? 0
                    : (value / analytics.totalReviews) * 100;

                return (
                  <div
                    key={rating}
                    className="flex items-center gap-3 py-2"
                  >
                    <div className="flex w-8 items-center gap-1 text-xs font-medium">
                      {rating}
                      <Star className="h-3 w-3 fill-current" />
                    </div>

                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="w-6 text-right text-xs text-muted-foreground">
                      {value}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">
              Locations
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              Review performance by business location.
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border bg-surface">
              <div className="grid grid-cols-[1fr_80px_80px_90px] border-b px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Location</span>
                <span className="text-right">Rating</span>
                <span className="text-right">Reviews</span>
                <span className="text-right">Responded</span>
              </div>

              {analytics.locations.map((location) => (
                <div
                  key={location.id}
                  className="grid grid-cols-[1fr_80px_80px_90px] items-center border-b px-4 py-3 text-xs last:border-b-0"
                >
                  <span className="truncate font-medium">
                    {location.name}
                  </span>

                  <span className="text-right">
                    {formatRating(location.averageRating)}
                  </span>

                  <span className="text-right text-muted-foreground">
                    {location.totalReviews}
                  </span>

                  <span className="text-right text-muted-foreground">
                    {location.respondedReviews}
                  </span>
                </div>
              ))}

              {analytics.locations.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No location data yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
