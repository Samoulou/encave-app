import { notFound } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getExperienceForBooking } from '@/server/actions/booking';
import { CheckoutClient } from './CheckoutClient';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
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
    error?: string;
  }>;
}

/**
 * Server component for checkout page.
 * Fetches experience data on the server to eliminate client-side waterfall.
 * (async-suspense-boundaries: Data is fetched before render, not in useEffect)
 */
export default async function CheckoutPage({ params, searchParams }: PageProps) {
  const [{ slug, locale }, search] = await Promise.all([params, searchParams]);
  const t = await getTranslations('checkout');

  // Validate required booking params
  const date = search.date;
  const time = search.time;
  const guests = search.guests;
  const paymentError = search.error || null;

  const guestCount = guests ? parseInt(guests, 10) : null;
  const hasValidParams = date && time && guestCount && guestCount > 0;

  // Fetch experience data on the server (eliminates client waterfall)
  const result = await getExperienceForBooking(slug);

  if (!result.success) {
    // Experience not found
    notFound();
  }

  const experience = result.data;

  // Invalid booking params - show error
  if (!hasValidParams) {
    return (
      <div className="w-full px-4 md:px-10 py-10">
        <div className="mx-auto max-w-7xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('invalidBookingParams')}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href={`/${locale}/experiences/${slug}`}>
                {t('backToBooking')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pass pre-fetched data to client component
  return (
    <CheckoutClient
      experience={experience}
      slug={slug}
      date={date}
      time={time}
      guestCount={guestCount}
      paymentError={paymentError}
    />
  );
}
