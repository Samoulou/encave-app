import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Sparkles, CalendarDays, Users, Clock } from 'lucide-react';
import { RequestOfferStatus } from '@prisma/client';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getRequestOfferByToken } from '@/server/queries/request.queries';
import { PayOfferButton } from '@/components/features/requests/PayOfferButton';
import { formatCHF } from '@/lib/utils/currency';
import { formatDate } from '@/lib/i18n/formatters';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

interface Props {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ status?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.surMesure',
    noIndex: true,
  });
}

export default async function OfferPaymentPage({
  params,
  searchParams,
}: Props) {
  const [{ locale, token }, { status }] = await Promise.all([
    params,
    searchParams,
  ]);
  setRequestLocale(locale);

  if (!(await isFlagEnabled('REQUESTS'))) {
    notFound();
  }

  const [t, offer] = await Promise.all([
    getTranslations('surMesure'),
    getRequestOfferByToken(token),
  ]);
  if (!offer) notFound();

  const localeTyped = locale as Locale;

  // Non-payable copy depends on WHY the offer can't be paid.
  const unavailable = offer.isPayable
    ? null
    : offer.status === RequestOfferStatus.PAID
      ? { title: t('offerPaidTitle'), body: t('offerPaidBody') }
      : offer.status === RequestOfferStatus.WITHDRAWN
        ? { title: t('offerWithdrawnTitle'), body: t('offerWithdrawnBody') }
        : { title: t('offerExpiredTitle'), body: t('offerExpiredBody') };

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-burgundy-100">
            <Sparkles
              className="h-7 w-7 text-burgundy-700"
              aria-hidden="true"
            />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('offerTitle')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('offerFrom', { winery: offer.wineryName })}
          </p>
        </div>

        {status === 'cancelled' && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-amber-600/30 bg-amber-50 p-4 text-amber-900"
          >
            <p className="font-semibold">{t('offerCancelledTitle')}</p>
            <p className="text-sm">{t('offerCancelledBody')}</p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-white p-6 shadow-warm">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t('offerMessageLabel')}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {offer.message}
            </p>
          </div>

          <dl className="mt-6 space-y-4 border-t border-stone-100 pt-6 text-sm">
            {offer.scheduledDate && (
              <div className="flex items-center gap-3">
                <CalendarDays
                  className="h-5 w-5 text-burgundy-600"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-muted-foreground">
                    {t('offerDateLabel')}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatDate(offer.scheduledDate, localeTyped)}
                    {offer.scheduledStartTime
                      ? ` · ${offer.scheduledStartTime}`
                      : ''}
                  </dd>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-burgundy-600" aria-hidden="true" />
              <div>
                <dt className="text-muted-foreground">
                  {t('offerGuestsLabel')}
                </dt>
                <dd className="font-medium text-foreground">
                  {t('guests', { count: offer.guestCount })}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-burgundy-600" aria-hidden="true" />
              <dt className="text-muted-foreground">
                {t('offerExpiryLabel', {
                  date: formatDate(offer.expiresAt, localeTyped),
                })}
              </dt>
            </div>
          </dl>

          <div className="mt-6 flex items-baseline justify-between border-t border-stone-100 pt-6">
            <span className="text-sm text-muted-foreground">
              {t('offerPriceLabel')}
            </span>
            <span className="font-display text-2xl font-bold text-burgundy-800">
              {formatCHF(offer.totalPrice)}
            </span>
          </div>
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {t('offerPriceNote')}
          </p>

          <div className="mt-6">
            {unavailable ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-center">
                <p className="font-semibold text-foreground">
                  {unavailable.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {unavailable.body}
                </p>
              </div>
            ) : (
              <PayOfferButton token={token} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
