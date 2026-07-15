import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { ChangePasswordSection } from '@/components/features/auth/ChangePasswordSection';
import { ChangeEmailSection } from '@/components/features/auth/ChangeEmailSection';
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
    namespace: 'metadata.dashboard.settings',
    noIndex: true,
  });
}

export default async function AccountSettingsPage() {
  const [session, locale, t, tNav] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations('accountSecurity'),
    getTranslations('nav'),
  ]);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const credentialAccount = await db.account.findFirst({
    where: { userId: session.user.id, providerId: 'credential' },
    select: { id: true },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <Breadcrumb
        items={[
          { label: tNav('settings'), href: '/dashboard/settings' },
          { label: t('title') },
        ]}
      />
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        {t('title')}
      </h1>
      <ChangeEmailSection currentEmail={session.user.email} />
      {credentialAccount && <ChangePasswordSection />}
    </div>
  );
}
