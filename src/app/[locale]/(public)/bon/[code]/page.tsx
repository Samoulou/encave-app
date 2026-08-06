import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getGiftCardByCode } from '@/server/queries/giftCard.queries';
import { formatGiftCodeForDisplay } from '@/server/services/giftCard.service';

interface Props {
  params: Promise<{ locale: string; code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.bon',
    noIndex: true,
  });
}

export default async function GiftCardPublicPage({ params }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  if (!(await isFlagEnabled('GIFT_CARDS'))) {
    notFound();
  }

  const t = await getTranslations('giftCards');
  const giftCard = await getGiftCardByCode(code);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        {!giftCard ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h1 className="font-serif text-2xl font-semibold">
              {t('notFoundTitle')}
            </h1>
            <p className="mt-2 text-muted-foreground">{t('notFoundBody')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] p-8 text-primary-foreground shadow-xl">
              <p className="text-xs uppercase tracking-widest opacity-80">
                {t('previewEyebrow')}
              </p>
              <h1 className="mt-1 font-serif text-2xl font-semibold">
                {t('giftHeroTitle')}
              </h1>
              {giftCard.purchaserName && (
                <p className="mt-1 text-sm opacity-90">
                  {t('giftFrom', { name: giftCard.purchaserName })}
                </p>
              )}
              <p className="mt-6 text-sm uppercase tracking-wide opacity-80">
                {t('balanceLabel')}
              </p>
              <p className="font-serif text-4xl font-bold">
                {formatCHF(giftCard.balance)}
              </p>
              <p className="mt-4 font-mono text-lg tracking-[0.3em]">
                {formatGiftCodeForDisplay(giftCard.code)}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('initialLabel')}</dt>
                <dd className="font-medium">
                  {formatCHF(giftCard.initialAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t('validUntilLabel')}
                </dt>
                <dd className="font-medium">
                  {formatDate(giftCard.expiresAt, locale as Locale)}
                </dd>
              </div>
            </dl>

            {giftCard.status === 'DISABLED' && (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {t('statusDisabled')}
              </p>
            )}
            {giftCard.status === 'ACTIVE' && giftCard.isExpired && (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {t('statusExpired')}
              </p>
            )}
            {giftCard.status === 'ACTIVE' &&
              !giftCard.isExpired &&
              giftCard.balance <= 0 && (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {t('statusUsedUp')}
                </p>
              )}

            {giftCard.status === 'ACTIVE' &&
              !giftCard.isExpired &&
              giftCard.balance > 0 && (
                <Button asChild size="lg" className="w-full">
                  <Link href="/experiences">{t('useCta')}</Link>
                </Button>
              )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
