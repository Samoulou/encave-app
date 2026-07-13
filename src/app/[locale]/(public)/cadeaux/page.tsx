import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getGiftableExperiences } from '@/server/queries/giftCard.queries';
import { GiftCardConfigurator } from '@/components/features/gift-cards/GiftCardConfigurator';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; experience?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.giftCards',
  });
}

export default async function GiftCardsPage({ params, searchParams }: Props) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  // Money feature behind the kill-switch: OFF → the page does not exist.
  if (!(await isFlagEnabled('GIFT_CARDS'))) {
    notFound();
  }

  const [t, experiences] = await Promise.all([
    getTranslations('giftCards'),
    getGiftableExperiences(),
  ]);

  const faqItems = [
    { q: t('faqValidityQ'), a: t('faqValidityA') },
    { q: t('faqPartialQ'), a: t('faqPartialA') },
    { q: t('faqUseQ'), a: t('faqUseA') },
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
        <header className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">
            {t('pageTitle')}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            {t('pageSubtitle')}
          </p>
        </header>

        {search.status === 'success' && (
          <div
            role="status"
            className="mb-8 rounded-lg border border-green-600/30 bg-green-50 p-4 text-green-900 dark:bg-green-950/40 dark:text-green-200"
          >
            <p className="font-semibold">{t('successTitle')}</p>
            <p className="text-sm">{t('successBody')}</p>
          </div>
        )}
        {search.status === 'cancelled' && (
          <div
            role="status"
            className="mb-8 rounded-lg border border-amber-600/30 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <p className="font-semibold">{t('cancelledTitle')}</p>
            <p className="text-sm">{t('cancelledBody')}</p>
          </div>
        )}

        <GiftCardConfigurator
          experiences={experiences}
          preselectExperienceId={
            search.experience &&
            experiences.some((e) => e.id === search.experience)
              ? search.experience
              : undefined
          }
        />

        <section className="mt-16">
          <h2 className="mb-4 font-serif text-2xl font-semibold">
            {t('faqTitle')}
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>
      <Footer />
    </>
  );
}
