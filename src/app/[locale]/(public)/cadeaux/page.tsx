import { Suspense } from 'react';
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
import { GiftCardsUrlState } from './GiftCardsUrlState';

interface Props {
  params: Promise<{ locale: string }>;
}

// ISR like the other public pages: the page no longer reads searchParams
// (see GiftCardsUrlState). The GIFT_CARDS flag read (60 s cache + tag)
// bounds how long a switched-off page can linger.
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    // Without `path` the canonical pointed at the home page: Google would
    // have folded /cadeaux into it.
    path: '/cadeaux',
    namespace: 'metadata.giftCards',
  });
}

export default async function GiftCardsPage({ params }: Props) {
  const { locale } = await params;
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
      <main
        id="main-content"
        className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16"
      >
        <header className="mb-10 text-center">
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">
            {t('pageTitle')}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            {t('pageSubtitle')}
          </p>
        </header>

        <Suspense fallback={<GiftCardConfigurator experiences={experiences} />}>
          <GiftCardsUrlState experiences={experiences} />
        </Suspense>

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
