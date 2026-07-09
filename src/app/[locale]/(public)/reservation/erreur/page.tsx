import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CalendarClock, CreditCard, SearchX } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BookingErrorAnalytics } from '@/components/features/checkout/BookingErrorAnalytics';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/i18n/formatters';
import { timeSlotSchema } from '@/lib/validators/booking';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.bookingError',
    noIndex: true,
  });
}

interface BookingErrorPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    cause?: string;
    slug?: string;
    date?: string;
    time?: string;
    guests?: string;
    holdId?: string;
    holdToken?: string;
    holdExpiresAt?: string;
  }>;
}

/**
 * Booking error page (P-04 / L-052) — the Stripe cancel_url and the
 * checkout hold-expiry redirect both land here. Two readable causes:
 * `payment` (retry the same hold if still alive, re-select otherwise)
 * and `hold-expired` (seats released, re-select with memorized params).
 */
export default async function BookingErrorPage({
  params,
  searchParams,
}: BookingErrorPageProps) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations('bookingError');

  const cause =
    search.cause === 'payment' || search.cause === 'hold-expired'
      ? search.cause
      : null;
  const { slug, date, time } = search;
  const guestCount = search.guests ? Number.parseInt(search.guests, 10) : NaN;
  // This is a public URL: a garbage `date` would throw a RangeError inside
  // Intl during formatDate and crash the server render — validate BOTH
  // date and time before any formatting.
  const hasSelection =
    Boolean(slug && date && time) &&
    Number.isInteger(guestCount) &&
    guestCount > 0 &&
    !Number.isNaN(Date.parse(date ?? '')) &&
    timeSlotSchema.safeParse(time).success;

  // Missing/invalid contract → generic fallback, never a broken screen.
  if (!cause || !hasSelection || !slug || !date || !time) {
    return (
      <>
        {cause && <BookingErrorAnalytics cause={cause} />}
        <ErrorShell
          icon={<SearchX className="h-8 w-8 text-burgundy-700" />}
          title={t('generic.title')}
          description={t('generic.description')}
        >
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/experiences">{t('generic.cta')}</Link>
          </Button>
        </ErrorShell>
      </>
    );
  }

  const selectionParams = new URLSearchParams({
    date,
    time,
    guests: String(guestCount),
  });
  const reselectHref = `/experiences/${slug}?${selectionParams.toString()}`;

  // Retry only makes sense while the claimed hold (Stripe session window)
  // is still alive — the extended expiresAt from the cancel_url is
  // authoritative here. The token is the ownership proof: without it the
  // checkout could not claim the hold, so retry needs the full trio.
  const holdExpiresAtMs = search.holdExpiresAt
    ? Date.parse(search.holdExpiresAt)
    : NaN;
  const holdStillActive =
    cause === 'payment' &&
    Boolean(search.holdId) &&
    Boolean(search.holdToken) &&
    !Number.isNaN(holdExpiresAtMs) &&
    holdExpiresAtMs > Date.now();

  const retryParams = new URLSearchParams(selectionParams);
  if (search.holdId && search.holdToken && search.holdExpiresAt) {
    retryParams.set('holdId', search.holdId);
    retryParams.set('holdToken', search.holdToken);
    retryParams.set('holdExpiresAt', search.holdExpiresAt);
  }
  const retryHref = `/experiences/${slug}/checkout?${retryParams.toString()}`;

  const selectionRecap = t('selectionRecap', {
    date: formatDate(date, locale as Locale),
    time,
    guests: guestCount,
  });

  if (cause === 'hold-expired') {
    return (
      <>
        <BookingErrorAnalytics cause={cause} />
        <ErrorShell
          icon={<CalendarClock className="h-8 w-8 text-burgundy-700" />}
          title={t('holdExpired.title')}
          description={t('holdExpired.description')}
          recap={selectionRecap}
        >
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={reselectHref} data-testid="reselect-cta">
              {t('reselectCta')}
            </Link>
          </Button>
        </ErrorShell>
      </>
    );
  }

  return (
    <>
      <BookingErrorAnalytics cause={cause} />
      <ErrorShell
        icon={<CreditCard className="h-8 w-8 text-burgundy-700" />}
        title={t('payment.title')}
        description={
          holdStillActive
            ? t('payment.description')
            : t('payment.descriptionHoldGone')
        }
        recap={selectionRecap}
      >
        {holdStillActive ? (
          <>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={retryHref} data-testid="retry-payment-cta">
                {t('payment.retryCta')}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link href={reselectHref} data-testid="reselect-cta">
                {t('reselectCta')}
              </Link>
            </Button>
          </>
        ) : (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={reselectHref} data-testid="reselect-cta">
              {t('reselectCta')}
            </Link>
          </Button>
        )}
      </ErrorShell>
    </>
  );
}

function ErrorShell({
  icon,
  title,
  description,
  recap,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  recap?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <Header />
      <main
        id="main-content"
        className="flex flex-1 justify-center px-4 py-12 md:py-20"
      >
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-burgundy-50">
            {icon}
          </div>
          <h1 className="text-balance font-display text-3xl font-semibold tracking-[-0.015em] text-ink-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-ink-700">
            {description}
          </p>
          {recap && (
            <div
              className="mt-6 rounded-[14px] border border-stone-200 bg-white p-4 text-sm font-semibold text-ink-900 shadow-audit-card"
              data-testid="selection-recap"
            >
              {recap}
            </div>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
