import * as Sentry from '@sentry/nextjs';

/**
 * Sentry Cron Monitors (P-16 / WS-E, L-184). Vercel Hobby caps us at daily
 * crons and no self-hosted poller — a DEAD cron (missed check-in) can only
 * be detected by Sentry's monitor schedule, declared here once per route.
 *
 * The schedule value MUST mirror vercel.json: routes invoked several times
 * a day under one path (reminders, process-scheduled-jobs, tasting) declare
 * the UNION crontab. Update both files together — a drift means false
 * "missed check-in" alerts.
 *
 * The wrapped handler must THROW on failure (never swallow) so the
 * check-in reports status=error; the route's outer catch then maps the
 * error to its HTTP 500 as before.
 */
export const CRON_SCHEDULES = {
  'encave-reminders': '0 16,17 * * *',
  'encave-daily-digest': '0 6 * * *',
  'encave-expire-pending-bookings': '0 3 * * *',
  'encave-generate-occurrences': '0 2 * * *',
  'encave-follow-ups': '0 8 * * *',
  'encave-weekly-summary': '0 6 * * 1',
  'encave-process-scheduled-jobs': '0 0,3,6,9,12,15,18,21 * * *',
  'encave-tasting-sheet-reminder': '0 19,20 * * *',
  'encave-reconcile-gift-transfers': '0 4 * * *',
} as const satisfies Record<string, string>;

export type CronMonitorSlug = keyof typeof CRON_SCHEDULES;

export async function withCronMonitor<T>(
  slug: CronMonitorSlug,
  handler: () => Promise<T>
): Promise<T> {
  // No DSN (local dev, e2e) → plain passthrough, no check-in attempts.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return handler();
  }
  return Sentry.withMonitor(slug, handler, {
    schedule: { type: 'crontab', value: CRON_SCHEDULES[slug] },
    timezone: 'Etc/UTC',
    // One missed daily run is already an incident, but Vercel's cron
    // latency on the Hobby plan is documented up to ~1h — a tighter
    // margin would page falsely every night (review #120 workflow).
    checkinMargin: 65,
    maxRuntime: 10,
  });
}
