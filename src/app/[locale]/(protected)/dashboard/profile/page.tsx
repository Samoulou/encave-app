import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import { ClientProfileForm } from '@/components/features/client-dashboard/ClientProfileForm';

export const metadata: Metadata = {
  title: 'My Profile | EnCave',
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const [session, locale, t] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations('clientDashboard.profile'),
  ]);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1a0f12]">
        {t('title')}
      </h1>
      <ClientProfileForm
        initialName={session.user.name ?? ''}
        email={session.user.email}
        initialLocale={session.user.preferredLocale}
      />
    </div>
  );
}
