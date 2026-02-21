import { redirect } from 'next/navigation';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.booking.book',
    noIndex: true,
  });
}

interface BookingPageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The /book page has been consolidated into the experience page.
 * This page now redirects to the experience page while preserving query params
 * for backwards compatibility.
 */
export default async function BookingPage({ params, searchParams }: BookingPageProps) {
  const { slug, locale } = await params;
  const resolvedSearchParams = await searchParams;

  // Build query string from search params
  const queryString = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => queryString.append(key, v));
      } else {
        queryString.set(key, value);
      }
    }
  }

  const queryPart = queryString.toString();
  const redirectUrl = `/${locale}/experiences/${slug}${queryPart ? `?${queryPart}` : ''}`;

  redirect(redirectUrl);
}
