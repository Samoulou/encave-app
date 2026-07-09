import { ClientBookingsPage } from '@/components/features/client-dashboard/ClientBookingsPage';
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
    namespace: 'metadata.dashboard.myBookings',
    noIndex: true,
  });
}

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <ClientBookingsPage tab={tab === 'past' ? 'past' : 'upcoming'} />;
}
