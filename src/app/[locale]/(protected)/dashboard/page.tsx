import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { auth } from '@/server/auth';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    path: '/dashboard',
    namespace: 'metadata.dashboard',
    noIndex: true,
  });
}

export default async function DashboardPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);

  if (session?.user?.role === 'CLIENT') {
    redirect(`/${locale}/dashboard/my-bookings`);
  }

  // Default: WINEMAKER and others
  redirect(`/${locale}/dashboard/bookings`);
}
