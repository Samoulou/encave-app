import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarPlus, Clock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getUpcomingWinerySessions } from '@/server/queries/dashboard-today.queries';
import { formatDate } from '@/lib/i18n/formatters';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/routing';

interface UpcomingSessionsCardProps {
  userId: string;
}

/**
 * « Prochains créneaux » (L-130): the winery's next bookable sessions
 * with seat gauges — same visual language as the occurrence sheet's
 * gauge, linking straight into each experience's session calendar.
 */
export async function UpcomingSessionsCard({
  userId,
}: UpcomingSessionsCardProps) {
  const [sessions, locale, t] = await Promise.all([
    getUpcomingWinerySessions(userId),
    getLocale(),
    getTranslations('Dashboard.today.upcoming'),
  ]);

  return (
    <section className="rounded-xl border border-border bg-white p-4 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t('title')}
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/experiences">{t('manageLink')}</Link>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center">
          <CalendarPlus
            className="mx-auto h-8 w-8 text-stone-400"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm text-muted-foreground">{t('empty')}</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/dashboard/experiences">{t('emptyCta')}</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-stone-100">
          {sessions.map((session) => {
            const gaugePercent =
              session.capacity > 0
                ? Math.min(
                    100,
                    Math.round((session.soldSeats / session.capacity) * 100)
                  )
                : 0;
            return (
              <li key={session.occurrenceId}>
                <Link
                  href={`/dashboard/experiences/${session.experienceId}/sessions`}
                  className="flex items-center gap-4 py-3 transition-colors hover:bg-stone-50"
                >
                  <div className="w-24 shrink-0 lg:w-32">
                    <p className="text-sm font-medium capitalize text-foreground">
                      {/* Date-only value (UTC midnight) — format in UTC. */}
                      {formatDate(session.date, locale as Locale, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'UTC',
                      })}
                    </p>
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {session.startTime}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {session.experienceTitle}
                    </p>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100"
                      role="progressbar"
                      aria-valuenow={session.soldSeats}
                      aria-valuemin={0}
                      aria-valuemax={session.capacity}
                    >
                      <div
                        className={cn(
                          'h-full rounded-full',
                          gaugePercent >= 100
                            ? 'bg-amber-500'
                            : 'bg-burgundy-600'
                        )}
                        style={{ width: `${gaugePercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {t('seats', {
                      sold: session.soldSeats,
                      capacity: session.capacity,
                    })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
