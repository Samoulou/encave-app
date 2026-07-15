import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';
import type {
  WebhookHealth,
  RecentIncidents,
} from '@/server/queries/admin-ops.queries';

interface AdminSystemHealthProps {
  webhook: WebhookHealth;
  incidents: RecentIncidents;
}

function formatLag(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Ops health panel for the admin dashboard (P-15 / L-160): Stripe webhook
 * health (lag / stuck / failed) plus the latest failed emails and jobs — the
 * first admin surface to READ StripeEvent / EmailLog / ScheduledJob.
 */
export function AdminSystemHealth({
  webhook,
  incidents,
}: AdminSystemHealthProps) {
  const t = useTranslations('admin.systemHealth');
  const locale = useLocale() as Locale;

  return (
    <Card className="mt-8 shadow-warm">
      <CardHeader className="border-b border-stone-100">
        <CardTitle className="font-display">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            {t('webhooks')}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {webhook.failedCount > 0 && (
              <Badge variant="destructive">
                {t('failedEvents', { count: webhook.failedCount })}
              </Badge>
            )}
            {webhook.stuckCount > 0 && (
              <Badge variant="warning">
                {t('stuckEvents', { count: webhook.stuckCount })}
              </Badge>
            )}
            {webhook.failedCount === 0 && webhook.stuckCount === 0 && (
              <Badge variant="success">{t('webhooksOk')}</Badge>
            )}
            <span className="text-slate-500">
              {t('lastEvent')}:{' '}
              {webhook.lastEventAt
                ? formatDateTime(webhook.lastEventAt, locale)
                : '—'}
            </span>
            <span className="text-slate-500">
              {t('avgLag')}: {formatLag(webhook.avgLagMs)} · {t('maxLag')}:{' '}
              {formatLag(webhook.maxLagMs)}
            </span>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            {t('failedEmails')}
            {incidents.failedEmails24h > 0
              ? ` (${incidents.failedEmails24h} / 24h)`
              : ''}
          </h3>
          {incidents.failedEmails.length === 0 ? (
            <p className="text-sm text-slate-500">{t('noFailedEmails')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {incidents.failedEmails.map((email) => (
                <li key={email.id} className="flex flex-wrap gap-2">
                  <span className="font-mono text-xs">{email.type}</span>
                  <span className="text-slate-500">
                    {formatDateTime(email.createdAt, locale)}
                  </span>
                  {email.errorMessage && (
                    <span className="text-red-700">{email.errorMessage}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            {t('failedJobs')}
          </h3>
          {incidents.failedJobs.length === 0 ? (
            <p className="text-sm text-slate-500">{t('noFailedJobs')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {incidents.failedJobs.map((job) => (
                <li key={job.id} className="flex flex-wrap gap-2">
                  <span className="font-mono text-xs">{job.type}</span>
                  <span className="text-slate-500">
                    {formatDateTime(job.runAt, locale)} ·{' '}
                    {t('attempts', { count: job.attempts })}
                  </span>
                  {job.lastError && (
                    <span className="text-red-700">{job.lastError}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
