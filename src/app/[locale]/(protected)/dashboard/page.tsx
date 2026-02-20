import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { auth } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Dashboard | EnCave',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);

  if (session?.user?.role === 'CLIENT') {
    redirect(`/${locale}/dashboard/my-bookings`);
  }

  // Default: WINEMAKER and others
  redirect(`/${locale}/dashboard/bookings`);
}
