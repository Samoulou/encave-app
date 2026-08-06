import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { ClientProfileForm } from '@/components/features/client-dashboard/ClientProfileForm';
import { DeleteAccountSection } from '@/components/features/client-dashboard/DeleteAccountSection';
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
    namespace: 'metadata.dashboard.profile',
    noIndex: true,
  });
}

export default async function ProfilePage() {
  const [session, locale, t] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations('clientDashboard.profile'),
  ]);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // P-14 (L-151): the change-password section only applies to credential
  // accounts — an OAuth-only (Google) user has no password to change.
  const credentialAccount = await db.account.findFirst({
    where: { userId: session.user.id, providerId: 'credential' },
    select: { id: true },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        {t('title')}
      </h1>
      <ClientProfileForm
        initialName={session.user.name ?? ''}
        email={session.user.email}
        initialLocale={session.user.preferredLocale}
      />
      <ChangeEmailSection currentEmail={session.user.email} />
      {credentialAccount && <ChangePasswordSection />}
      <DeleteAccountSection email={session.user.email} />
    </div>
  );
}
