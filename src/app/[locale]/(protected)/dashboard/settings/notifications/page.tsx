import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getNotificationPreferences } from '@/server/actions/notifications';
import { NotificationPreferencesForm } from '@/components/features/settings/NotificationPreferencesForm';
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
    namespace: 'metadata.dashboard.notifications',
    noIndex: true,
  });
}

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  const result = await getNotificationPreferences();

  if (!result.success) {
    const locale = await getLocale();
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Email Notifications
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose which emails you would like to receive
        </p>
      </div>

      <NotificationPreferencesForm initialData={result.data} />

      {/* Transactional Emails Info */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-medium text-slate-900">
          Transactional Emails
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Booking confirmations, cancellations, and payment receipts cannot be
          disabled as they contain important information about your
          reservations.
        </p>
      </div>
    </div>
  );
}
