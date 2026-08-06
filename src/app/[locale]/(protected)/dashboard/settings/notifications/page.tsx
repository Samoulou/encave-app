import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
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

  const t = await getTranslations('settings.notifications');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t('emailNotifications')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('emailNotificationsDescription')}
        </p>
      </div>

      <NotificationPreferencesForm initialData={result.data} />

      {/* Transactional Emails Info */}
      <div className="rounded-lg border border-border bg-muted p-4">
        <h3 className="text-sm font-medium text-foreground">
          {t('transactionalTitle')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('transactionalDescription')}
        </p>
      </div>
    </div>
  );
}
