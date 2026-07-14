import { getTranslations } from 'next-intl/server';
import { Compass, CalendarCheck, Wine, Gift, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';

interface HomeConversionSectionsProps {
  giftCardsEnabled: boolean;
  requestsEnabled: boolean;
}

/**
 * Home conversion sections (P-12 / L-113): « comment ça marche » + bon cadeau
 * (GIFT_CARDS) + sur-mesure (REQUESTS). One responsive server component
 * rendered once by the home page — no auth/headers/cookies, so the home stays
 * ISR. Gift-card and sur-mesure blocks are flag-gated.
 */
export async function HomeConversionSections({
  giftCardsEnabled,
  requestsEnabled,
}: HomeConversionSectionsProps) {
  const t = await getTranslations('home');

  const steps = [
    { icon: Compass, key: 'step1' },
    { icon: CalendarCheck, key: 'step2' },
    { icon: Wine, key: 'step3' },
  ] as const;

  return (
    <div className="bg-cream-50">
      {/* Comment ça marche */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
            {t('howItWorks.title')}
          </h2>
          <p className="text-ink-600 mt-3">{t('howItWorks.subtitle')}</p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map(({ icon: Icon, key }, index) => (
            <div key={key} className="text-center">
              <div className="relative mx-auto mb-5 inline-flex">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-burgundy-100">
                  <Icon
                    className="h-7 w-7 text-burgundy-600"
                    aria-hidden="true"
                  />
                </div>
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-burgundy-600 font-mono text-sm font-bold text-white">
                  {index + 1}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold text-ink-900">
                {t(`howItWorks.${key}.title`)}
              </h3>
              <p className="text-ink-600 mt-2 text-sm">
                {t(`howItWorks.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bon cadeau + sur-mesure */}
      {(giftCardsEnabled || requestsEnabled) && (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-10">
          <div className="grid gap-6 md:grid-cols-2">
            {giftCardsEnabled && (
              <div className="flex flex-col justify-between rounded-2xl border border-gold-200 bg-gradient-to-br from-gold-50 to-cream-100 p-8">
                <div>
                  <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
                    <Gift className="h-4 w-4" aria-hidden="true" />
                    {t('giftCard.eyebrow')}
                  </span>
                  <h3 className="mt-3 font-display text-2xl font-semibold text-ink-900">
                    {t('giftCard.title')}
                  </h3>
                  <p className="text-ink-600 mt-2">{t('giftCard.subtitle')}</p>
                </div>
                <Link
                  href="/cadeaux"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-burgundy-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-burgundy-800"
                >
                  {t('giftCard.cta')}
                </Link>
              </div>
            )}

            {requestsEnabled && (
              <div className="flex flex-col justify-between rounded-2xl border border-burgundy-100 bg-white p-8">
                <div>
                  <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {t('surMesure.eyebrow')}
                  </span>
                  <h3 className="mt-3 font-display text-2xl font-semibold text-ink-900">
                    {t('surMesure.title')}
                  </h3>
                  <p className="text-ink-600 mt-2">{t('surMesure.subtitle')}</p>
                </div>
                <Link
                  href="/sur-mesure"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg border border-burgundy-200 px-5 py-3 text-sm font-semibold text-burgundy-700 transition-colors hover:bg-burgundy-50"
                >
                  {t('surMesure.cta')}
                </Link>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
