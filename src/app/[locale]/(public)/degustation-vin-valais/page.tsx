import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Wine, Clock, MapPin, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { FaqSchema } from '@/components/seo/FaqSchema';
import { FaqAccordion } from '@/components/shared/FaqAccordion';
import { JsonLd } from '@/components/shared/JsonLd';
import { getBaseUrl } from '@/lib/env';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.degustation' });

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
    keywords: t('metadata.keywords'),
    openGraph: {
      title: t('metadata.title'),
      description: t('metadata.description'),
      type: 'website',
    },
  };
}

export default async function DegustationVinValaisPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing.degustation');
  const baseUrl = getBaseUrl();

  // FAQ items for schema and display
  const faqItems = [
    { question: t('faq.q1.question'), answer: t('faq.q1.answer') },
    { question: t('faq.q2.question'), answer: t('faq.q2.answer') },
    { question: t('faq.q3.question'), answer: t('faq.q3.answer') },
    { question: t('faq.q4.question'), answer: t('faq.q4.answer') },
    { question: t('faq.q5.question'), answer: t('faq.q5.answer') },
  ];

  // Breadcrumb schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'EnCave',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: t('hero.title'),
        item: `${baseUrl}/${locale}/degustation-vin-valais`,
      },
    ],
  };

  return (
    <>
      <FaqSchema items={faqItems} />
      <JsonLd data={breadcrumbSchema} />
      <div className="min-h-screen bg-cream-50">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-burgundy-800 via-burgundy-700 to-burgundy-900 py-20 lg:py-28">
          <div className="absolute inset-0 bg-[url('/images/wine-texture.png')] opacity-5" />
          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <Wine
              className="mx-auto mb-6 h-12 w-12 text-gold-400"
              aria-hidden="true"
            />
            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-burgundy-100">
              {t('hero.subtitle')}
            </p>
          </div>
        </section>

        {/* Breadcrumb Navigation */}
        <nav className="mx-auto max-w-6xl px-6 py-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-slate-600">
            <li>
              <Link
                href="/"
                className="transition-colors hover:text-burgundy-600"
              >
                EnCave
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-slate-900">{t('hero.title')}</li>
          </ol>
        </nav>

        {/* Introduction Section */}
        <section className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
          <Card className="overflow-hidden rounded-xl border-0 shadow-warm-lg">
            <CardContent className="p-8 sm:p-10">
              <h2 className="mb-6 font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
                {t('intro.title')}
              </h2>
              <div className="space-y-4 leading-relaxed text-slate-700">
                <p>{t('intro.paragraph1')}</p>
                <p>{t('intro.paragraph2')}</p>
                <p>{t('intro.paragraph3')}</p>
              </div>

              {/* Highlights */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg bg-burgundy-50 p-4">
                  <Clock
                    className="h-5 w-5 text-burgundy-600"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-slate-900">
                    {t('intro.highlight1')}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-burgundy-50 p-4">
                  <MapPin
                    className="h-5 w-5 text-burgundy-600"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-slate-900">
                    {t('intro.highlight2')}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-burgundy-50 p-4">
                  <Star
                    className="h-5 w-5 text-burgundy-600"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-slate-900">
                    {t('intro.highlight3')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQ Section */}
        <section className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
          <h2 className="mb-8 text-center font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
            {t('faq.title')}
          </h2>
          <Card className="overflow-hidden rounded-xl border-0 shadow-warm-lg">
            <CardContent className="p-8 sm:p-10">
              <FaqAccordion items={faqItems} />
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
