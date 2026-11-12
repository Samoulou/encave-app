'use client';

import { parseAsString, useQueryState } from 'nuqs';
import { useTranslations } from 'next-intl';
import { GiftCardConfigurator } from '@/components/features/gift-cards/GiftCardConfigurator';
import type { GiftableExperience } from '@/server/queries/giftCard.queries';

/**
 * URL-dependent part of /cadeaux: the Stripe return banner (?status=) and
 * the deep link from a fiche (?experience=). Reading them HERE (client,
 * nuqs) instead of `searchParams` in the page keeps the page static/ISR —
 * it used to be rendered on every request for these two optional params.
 * Mounted under its own Suspense: the fallback is the plain configurator.
 */
export function GiftCardsUrlState({
  experiences,
}: {
  experiences: GiftableExperience[];
}) {
  const t = useTranslations('giftCards');
  const [status] = useQueryState('status', parseAsString);
  const [experienceId] = useQueryState('experience', parseAsString);

  const preselectExperienceId =
    experienceId && experiences.some((e) => e.id === experienceId)
      ? experienceId
      : undefined;

  return (
    <>
      {status === 'success' && (
        <div
          role="status"
          className="mb-8 rounded-lg border border-green-600/30 bg-green-50 p-4 text-green-900 dark:bg-green-950/40 dark:text-green-200"
        >
          <p className="font-semibold">{t('successTitle')}</p>
          <p className="text-sm">{t('successBody')}</p>
        </div>
      )}
      {status === 'cancelled' && (
        <div
          role="status"
          className="mb-8 rounded-lg border border-amber-600/30 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="font-semibold">{t('cancelledTitle')}</p>
          <p className="text-sm">{t('cancelledBody')}</p>
        </div>
      )}

      {/* key: the form reads its defaults once — remount when the deep link
          resolves so the preselected experience is applied. */}
      <GiftCardConfigurator
        key={preselectExperienceId ?? 'default'}
        experiences={experiences}
        preselectExperienceId={preselectExperienceId}
      />
    </>
  );
}
