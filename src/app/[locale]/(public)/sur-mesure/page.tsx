import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getRequestableWineries } from '@/server/queries/request.queries';
import { SurMesureForm } from '@/components/features/requests/SurMesureForm';

// ISR: the winery picker (getRequestableWineries, tagged 'wineries') must not
// be frozen into a static prerender until redeploy — revalidate on a TTL and
// on any admin winery mutation.
export const revalidate = 300;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    path: '/sur-mesure',
    namespace: 'metadata.surMesure',
    noIndex: true,
  });
}

export default async function SurMesurePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Feature behind the kill-switch: OFF → the page does not exist.
  if (!(await isFlagEnabled('REQUESTS'))) {
    notFound();
  }

  const [t, wineries] = await Promise.all([
    getTranslations('surMesure'),
    getRequestableWineries(),
  ]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:py-16">
        <header className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">
            {t('pageTitle')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {t('pageSubtitle')}
          </p>
        </header>

        <SurMesureForm wineries={wineries} />
      </main>
      <Footer />
    </>
  );
}
