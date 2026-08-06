import { getTranslations } from 'next-intl/server';
import { InvitationGenerator } from '@/components/features/admin/InvitationGenerator';
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

export default async function AdminInvitationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.invitations' });

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-display-md text-burgundy-700">
          {t('title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <InvitationGenerator />
    </div>
  );
}
