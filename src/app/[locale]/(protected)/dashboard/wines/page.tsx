import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { Mail, MousePointerClick, Send } from 'lucide-react';
import { auth } from '@/server/auth';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import {
  getOwnerWines,
  getTastingEmailStats,
} from '@/server/queries/wine.queries';
import { WinesManager } from '@/components/features/wine/WinesManager';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.wines',
    noIndex: true,
  });
}

export default async function WinesPage() {
  const session = await auth();
  if (!session?.user) {
    const locale = await getLocale();
    redirect({ href: '/login', locale });
    return null;
  }

  // Whole surface is flag-gated (P-07): OFF = the page does not exist.
  const tastingEnabled = await isFlagEnabled('TASTING_SHEET');
  if (!tastingEnabled) {
    notFound();
  }

  const [wines, stats, t] = await Promise.all([
    getOwnerWines(session.user.id),
    getTastingEmailStats(session.user.id),
    getTranslations('Dashboard.wines'),
  ]);

  const statItems = [
    { key: 'statsSent', value: stats.sent, icon: Send },
    { key: 'statsOpened', value: stats.opened, icon: Mail },
    { key: 'statsClicked', value: stats.clicked, icon: MousePointerClick },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        <p className="mt-1 text-xs font-medium text-gold-700">
          {t('shopTeaser')}
        </p>
      </div>

      {/* J+2 recap engagement, per winery (DoD: open/click tracés) */}
      {stats.sent > 0 && (
        <section
          aria-label={t('statsTitle')}
          className="grid grid-cols-3 gap-3"
        >
          {statItems.map(({ key, value, icon: Icon }) => (
            <div
              key={key}
              className="rounded-xl border border-border bg-white p-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs">{t(key)}</span>
              </div>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {value}
              </p>
            </div>
          ))}
        </section>
      )}

      <WinesManager wines={wines} />
    </div>
  );
}
