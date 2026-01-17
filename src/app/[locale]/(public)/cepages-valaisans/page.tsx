import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Grape, ArrowRight, Wine } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JsonLd } from '@/components/shared/JsonLd';
import { getBaseUrl } from '@/lib/env';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.cepages' });

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

export default async function CepagesValaisansPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing.cepages');

  const baseUrl = getBaseUrl();

  // White grape varieties
  const whiteGrapes = ['petiteArvine', 'amigne', 'heida', 'humagneBlanc'] as const;

  // Red grape varieties
  const redGrapes = ['cornalin', 'humagneRouge'] as const;

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
        item: `${baseUrl}/${locale}/cepages-valaisans`,
      },
    ],
  };

  // ItemList schema for grape varieties
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t('hero.title'),
    description: t('metadata.description'),
    numberOfItems: whiteGrapes.length + redGrapes.length,
    itemListElement: [
      ...whiteGrapes.map((grape, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: t(`whites.${grape}.name`),
        description: t(`whites.${grape}.description`),
      })),
      ...redGrapes.map((grape, index) => ({
        '@type': 'ListItem',
        position: whiteGrapes.length + index + 1,
        name: t(`reds.${grape}.name`),
        description: t(`reds.${grape}.description`),
      })),
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={itemListSchema} />
      <div className="min-h-screen bg-cream-50">
        <Header />

        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-burgundy-800 via-burgundy-700 to-burgundy-900 py-20 lg:py-28">
          <div className="absolute inset-0 bg-[url('/images/wine-texture.png')] opacity-5" />
          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <Grape className="mx-auto mb-6 h-12 w-12 text-gold-400" aria-hidden="true" />
            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mt-4 text-lg text-burgundy-100 max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>
          </div>
        </section>

        {/* Breadcrumb Navigation */}
        <nav className="mx-auto max-w-6xl px-6 py-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-slate-600">
            <li>
              <Link href="/" className="hover:text-burgundy-600 transition-colors">
                EnCave
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-900 font-medium">{t('hero.title')}</li>
          </ol>
        </nav>

        {/* Introduction Section */}
        <section className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
          <Card className="overflow-hidden rounded-xl border-0 shadow-warm-lg">
            <CardContent className="p-8 sm:p-10">
              <h2 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl mb-6">
                {t('intro.title')}
              </h2>
              <div className="space-y-4 text-slate-700 leading-relaxed">
                <p>{t('intro.paragraph1')}</p>
                <p>{t('intro.paragraph2')}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* White Grapes Section */}
        <section className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
          <h2 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl mb-8 text-center">
            {t('whites.title')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {whiteGrapes.map((grape) => (
              <Card key={grape} className="overflow-hidden rounded-xl border-0 shadow-warm hover:shadow-warm-lg transition-shadow">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-100">
                      <Wine className="h-6 w-6 text-gold-600" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-slate-900">
                        {t(`whites.${grape}.name`)}
                      </h3>
                      <p className="mt-2 text-slate-600 text-sm">
                        {t(`whites.${grape}.description`)}
                      </p>
                      <div className="mt-4 space-y-2">
                        <p className="text-sm">
                          <span className="font-medium text-slate-900">{t('labels.tasting')}:</span>{' '}
                          <span className="text-slate-600">{t(`whites.${grape}.tasting`)}</span>
                        </p>
                        <p className="text-sm">
                          <span className="font-medium text-slate-900">{t('labels.pairing')}:</span>{' '}
                          <span className="text-slate-600">{t(`whites.${grape}.pairing`)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Red Grapes Section */}
        <section className="mx-auto max-w-6xl px-6 py-12 lg:py-16 bg-burgundy-50/50">
          <h2 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl mb-8 text-center">
            {t('reds.title')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
            {redGrapes.map((grape) => (
              <Card key={grape} className="overflow-hidden rounded-xl border-0 shadow-warm hover:shadow-warm-lg transition-shadow">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-burgundy-100">
                      <Wine className="h-6 w-6 text-burgundy-600" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-slate-900">
                        {t(`reds.${grape}.name`)}
                      </h3>
                      <p className="mt-2 text-slate-600 text-sm">
                        {t(`reds.${grape}.description`)}
                      </p>
                      <div className="mt-4 space-y-2">
                        <p className="text-sm">
                          <span className="font-medium text-slate-900">{t('labels.tasting')}:</span>{' '}
                          <span className="text-slate-600">{t(`reds.${grape}.tasting`)}</span>
                        </p>
                        <p className="text-sm">
                          <span className="font-medium text-slate-900">{t('labels.pairing')}:</span>{' '}
                          <span className="text-slate-600">{t(`reds.${grape}.pairing`)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Where to Taste Section */}
        <section className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
          <Card className="overflow-hidden rounded-xl border-0 shadow-warm-lg">
            <CardContent className="p-8 sm:p-10 text-center">
              <Grape className="mx-auto mb-4 h-10 w-10 text-burgundy-600" aria-hidden="true" />
              <h2 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl mb-4">
                {t('taste.title')}
              </h2>
              <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
                {t('taste.description')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href="/experiences">
                    {t('taste.experiencesButton')}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/wineries">
                    {t('taste.wineriesButton')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-br from-burgundy-800 via-burgundy-700 to-burgundy-900 py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl mb-4">
              {t('cta.title')}
            </h2>
            <p className="text-burgundy-100 mb-8 max-w-2xl mx-auto">
              {t('cta.subtitle')}
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/experiences">
                {t('cta.button')}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
