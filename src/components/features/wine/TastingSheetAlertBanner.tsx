import { GlassWater } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getOwnerEmptySheetSessionsToday } from '@/server/queries/wine.queries';

interface TastingSheetAlertBannerProps {
  userId: string;
}

/**
 * Dashboard alert (P-07 / L-063): today's ended sessions whose tasting
 * sheet is still empty. Server component, renders nothing when the flag
 * is OFF or there is nothing to flag — visual twin of the amber
 * VisibilityBanner "partial" state.
 */
export async function TastingSheetAlertBanner({
  userId,
}: TastingSheetAlertBannerProps) {
  if (!(await isFlagEnabled('TASTING_SHEET'))) return null;
  const sessions = await getOwnerEmptySheetSessionsToday(userId);
  if (sessions.length === 0) return null;
  const first = sessions[0];
  if (!first) return null;

  const t = await getTranslations('Dashboard.tastingSheet');

  return (
    <section
      role="region"
      aria-label={t('alertTitle')}
      className="rounded-xl border border-amber-200 bg-amber-50/50 p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <GlassWater className="h-5 w-5 text-amber-700" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-medium text-amber-900">{t('alertTitle')}</h2>
            <p className="mt-0.5 text-sm text-amber-800">
              {t('alertDescription', { count: sessions.length })}
            </p>
            <ul className="mt-1 text-xs text-amber-700">
              {sessions.map((session) => (
                <li key={`${session.experienceId}|${session.timeSlot}`}>
                  {session.experienceTitle} — {session.timeSlot}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Button asChild size="lg" className="min-h-[44px] shrink-0">
          <Link href={`/dashboard/experiences/${first.experienceId}/sessions`}>
            {t('alertCta')}
          </Link>
        </Button>
      </div>
    </section>
  );
}
