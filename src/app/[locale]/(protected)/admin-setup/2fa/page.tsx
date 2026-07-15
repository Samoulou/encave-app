import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth, getCurrentUserTwoFactorEnabled } from '@/server/auth';
import { TotpSetupSection } from '@/components/features/auth/TotpSetupSection';
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
    namespace: 'metadata.admin',
    noIndex: true,
  });
}

/**
 * Forced TOTP enrolment for admins (P-14 / L-152). Lives OUTSIDE the admin
 * layout so the layout's "no-TOTP → setup" redirect can't loop. The
 * (protected) layout provides the session gate + full client messages.
 */
export default async function AdminTotpSetupPage() {
  const [session, locale, t] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations('accountSecurity'),
  ]);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }
  if (session.user.role !== 'ADMIN') {
    notFound();
  }
  // Already enrolled → nothing to do here.
  if (await getCurrentUserTwoFactorEnabled()) {
    redirect(`/${locale}/admin`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          {t('totp.forcedTitle')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('totp.forcedSubtitle')}</p>
      </div>
      <TotpSetupSection redirectTo="/admin" />
    </div>
  );
}
