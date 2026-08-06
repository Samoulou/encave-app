import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatCHF } from '@/lib/utils/currency';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';
import {
  getAdminGiftCards,
  getGiftCardLiabilityCents,
} from '@/server/queries/giftCard.queries';
import { AdminGiftCardsTable } from '@/components/features/admin/AdminGiftCardsTable';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.admin',
    noIndex: true,
  });
}

export default async function AdminGiftCardsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, liability, cards] = await Promise.all([
    getTranslations('giftCards'),
    getGiftCardLiabilityCents(),
    getAdminGiftCards(),
  ]);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="font-serif text-2xl font-bold">{t('adminTitle')}</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{t('adminLiability')}</p>
        <p className="font-serif text-3xl font-bold">{formatCHF(liability)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('adminLiabilityHelp')}
        </p>
      </div>

      <AdminGiftCardsTable cards={cards} locale={locale as Locale} />
    </div>
  );
}
