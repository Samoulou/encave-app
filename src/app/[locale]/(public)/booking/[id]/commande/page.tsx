import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GlassWater } from 'lucide-react';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getWineOrderPageData } from '@/server/queries/wine.queries';
import { WineOrderForm } from '@/components/features/wine/WineOrderForm';
import { getPostHogServer } from '@/lib/posthog';
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
    namespace: 'metadata.wineOrder',
    noIndex: true,
  });
}

interface WineOrderPageProps {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

/**
 * Tokenized wine-order page (P-07 / D3): the J+2 recap CTA lands here.
 * Strictly read-only on GET — the request is sent by the 1-tap POST in
 * WineOrderForm (mail scanners pre-opening the link cause no mutation).
 */
export default async function WineOrderPage({
  params,
  searchParams,
}: WineOrderPageProps) {
  const [{ id, locale }, { token }] = await Promise.all([
    params,
    searchParams,
  ]);
  setRequestLocale(locale as Locale);

  if (!token) notFound();
  const tastingEnabled = await isFlagEnabled('TASTING_SHEET');
  if (!tastingEnabled) notFound();

  const [data, t] = await Promise.all([
    getWineOrderPageData(id, token),
    getTranslations('wineOrder'),
  ]);
  if (!data) notFound();

  // First-party CTA-click signal (A3 fallback when the Resend webhook
  // isn't configured yet).
  const posthog = getPostHogServer();
  if (posthog) {
    posthog.capture({
      distinctId: data.guestName,
      event: 'wine_order_page_viewed',
      properties: { bookingId: data.bookingId },
    });
    await posthog.flush();
  }

  return (
    <div className="min-h-screen bg-cream-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-burgundy-100">
            <GlassWater
              className="h-7 w-7 text-burgundy-700"
              aria-hidden="true"
            />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('title', { wineryName: data.wineryName })}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <WineOrderForm
          bookingId={data.bookingId}
          token={token}
          wines={data.wines}
          alreadyRequested={data.alreadyRequested}
          wineryName={data.wineryName}
        />
      </div>
    </div>
  );
}
