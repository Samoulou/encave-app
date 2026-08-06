import { notFound } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getExperienceForBooking } from '@/server/actions/booking';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { BOOKING_FEE_CENTS } from '@/lib/constants/pricing';
import { CheckoutClient } from './CheckoutClient';
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
    namespace: 'metadata.booking.checkout',
    noIndex: true,
  });
}

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<{
    date?: string;
    time?: string;
    guests?: string;
    holdId?: string;
    holdToken?: string;
    holdExpiresAt?: string;
  }>;
}

/**
 * Loose cuid shape check. A malformed holdId (truncated URL, tampering)
 * must degrade to the no-hold flow here — never reach the submit, where
 * the schema's `.cuid()` would fail the whole checkout with an opaque
 * "Invalid input data".
 */
const CUID_PATTERN = /^c[a-z0-9]{20,}$/i;

/**
 * Server component for checkout page.
 * Fetches experience data on the server to eliminate client-side waterfall.
 * (async-suspense-boundaries: Data is fetched before render, not in useEffect)
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps) {
  const [{ slug, locale }, search] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations('checkout');

  // Validate required booking params
  const date = search.date;
  const time = search.time;
  const guests = search.guests;

  const guestCount = guests ? parseInt(guests, 10) : null;
  const hasValidParams = date && time && guestCount && guestCount > 0;

  // Hold created at « Continuer » (P-04 / L-050). The full trio
  // holdId/holdToken/holdExpiresAt must be present and well-formed —
  // otherwise the checkout degrades to the hold-at-submit flow (no
  // countdown, no claimed hold).
  const holdId =
    search.holdId && CUID_PATTERN.test(search.holdId) ? search.holdId : null;
  const holdToken = search.holdToken || null;
  const holdExpiresAt =
    search.holdExpiresAt && !Number.isNaN(Date.parse(search.holdExpiresAt))
      ? search.holdExpiresAt
      : null;
  const hasHold =
    holdId !== null && holdToken !== null && holdExpiresAt !== null;

  // Fetch experience data on the server (eliminates client waterfall).
  // Booking fee (P-03 / L-041): the flag is read server-side so the client
  // only ever renders the amount — flag OFF means 0, same display as before.
  const [result, bookingFeeEnabled, giftEnabled, noShowFeesEnabled] =
    await Promise.all([
      getExperienceForBooking(slug),
      isFlagEnabled('BOOKING_FEE'),
      isFlagEnabled('GIFT_CARDS'),
      isFlagEnabled('NO_SHOW_FEES'),
    ]);

  if (!result.success) {
    // Experience not found
    notFound();
  }

  const experience = result.data;

  // P-08: ON_SITE / free offers take no online charge. When the winery opts
  // into no-show fees, checkout collects a card imprint and the client accepts
  // the fee — no service fee is added to an ON_SITE booking.
  const isOnSite = experience.paymentMode === 'ON_SITE';
  const noShowFeeCentsPerGuest =
    noShowFeesEnabled && isOnSite && experience.winery.noShowFeeEnabled
      ? experience.winery.noShowFeeCents
      : 0;
  const serviceFeeCentsPerGuest =
    !isOnSite && bookingFeeEnabled ? BOOKING_FEE_CENTS : 0;

  // Invalid booking params - show error
  if (!hasValidParams) {
    return (
      <div className="w-full px-4 py-10 md:px-10">
        <div className="mx-auto max-w-7xl">
          <Alert variant="destructive" data-testid="missing-params-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('invalidBookingParams')}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href={`/experiences/${slug}`}>{t('backToBooking')}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pass pre-fetched data to client component. `serverNowMs` anchors the
  // hold countdown on the server clock — a wrong client clock would
  // otherwise show a bogus timer.
  return (
    <CheckoutClient
      experience={experience}
      slug={slug}
      date={date}
      time={time}
      guestCount={guestCount}
      serviceFeeCentsPerGuest={serviceFeeCentsPerGuest}
      noShowFeeCentsPerGuest={noShowFeeCentsPerGuest}
      holdId={hasHold ? holdId : null}
      holdToken={hasHold ? holdToken : null}
      holdExpiresAt={hasHold ? holdExpiresAt : null}
      serverNowMs={Date.now()}
      giftEnabled={giftEnabled}
    />
  );
}
