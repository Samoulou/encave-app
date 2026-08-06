import { Inbox } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getStaleRequestCount } from '@/server/queries/request.queries';

interface RequestsAlertBannerProps {
  wineryId: string;
}

/**
 * Dashboard alert (P-10 / L-094): sur-mesure requests still PENDING and
 * older than 24h. Server component, renders nothing when the REQUESTS flag
 * is OFF or there is nothing to flag — visual twin of the amber
 * TastingSheetAlertBanner.
 */
export async function RequestsAlertBanner({
  wineryId,
}: RequestsAlertBannerProps) {
  if (!(await isFlagEnabled('REQUESTS'))) return null;
  const staleCount = await getStaleRequestCount(wineryId);
  if (staleCount === 0) return null;

  const t = await getTranslations('requests');

  return (
    <section
      role="region"
      aria-label={t('alertTitle')}
      className="rounded-xl border border-amber-200 bg-amber-50/50 p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <Inbox className="h-5 w-5 text-amber-700" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-medium text-amber-900">{t('alertTitle')}</h2>
            <p className="mt-0.5 text-sm text-amber-800">
              {t('alertDescription', { count: staleCount })}
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="min-h-[44px] shrink-0">
          <Link href="/dashboard/demandes">{t('alertCta')}</Link>
        </Button>
      </div>
    </section>
  );
}
