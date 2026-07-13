import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { auth } from '@/server/auth';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';
import { getMyGiftCards } from '@/server/queries/giftCard.queries';
import { MyGiftCardsList } from '@/components/features/gift-cards/MyGiftCardsList';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.bon',
    noIndex: true,
  });
}

export default async function MyGiftCardsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/${locale}/login`);
  }

  const [t, cards] = await Promise.all([
    getTranslations('giftCards'),
    getMyGiftCards(session.user.email),
  ]);

  // Chrome (sidebar + main) comes from the /dashboard layout.
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 font-serif text-2xl font-bold sm:text-3xl">
        {t('compteTitle')}
      </h1>
      <MyGiftCardsList cards={cards} locale={locale as Locale} />
    </div>
  );
}
