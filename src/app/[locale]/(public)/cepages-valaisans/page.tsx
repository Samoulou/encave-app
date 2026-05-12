import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Grape, Wine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { JsonLd } from '@/components/shared/JsonLd';
import { getBaseUrl } from '@/lib/env';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
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
  const whiteGrapes = [
    'petiteArvine',
    'amigne',
    'heida',
    'humagneBlanc',
  ] as const;

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
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-burgundy-800 via-burgundy-700 to-burgundy-900 py-20 lg:py-28">
          <div className="absolute inset-0 bg-[url('/images/wine-texture.png')] opacity-5" />
          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <Grape
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
              </div>
            </CardContent>
          </Card>
        </section>

        {/* White Grapes Section */}
        <section className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
          <h2 className="mb-8 text-center font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
            {t('whites.title')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {whiteGrapes.map((grape) => (
              <Card
                key={grape}
                className="overflow-hidden rounded-xl border-0 shadow-warm transition-shadow hover:shadow-warm-lg"
              >
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-100">
                      <Wine
                        className="h-6 w-6 text-gold-600"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-slate-900">
                        {t(`whites.${grape}.name`)}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {t(`whites.${grape}.description`)}
                      </p>
                      <div className="mt-4 space-y-2">
                        <p className="text-sm">
                          <span className="font-medium text-slate-900">
                            {t('labels.tasting')}:
                          </span>{' '}
                          <span className="text-slate-600">
                            {t(`whites.${grape}.tasting`)}
                          </span>
                        </p>
                        <p className="text-sm">
                          <span className="font-medium text-slate-900">
                            {t('labels.pairing')}:
                          </span>{' '}
                          <span className="text-slate-600">
                            {t(`whites.${grape}.pairing`)}
                          </span>
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
        <section className="mx-auto max-w-6xl bg-burgundy-50/50 px-6 py-12 lg:py-16">
          <h2 className="mb-8 text-center font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
            {t('reds.title')}
          </h2>
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
            {redGrapes.map((grape) => (
              <Card
                key={grape}
                className="overflow-hidden rounded-xl border-0 shadow-warm transition-shadow hover:shadow-warm-lg"
              >
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-burgundy-100">
                      <Wine
                        className="h-6 w-6 text-burgundy-600"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-slate-900">
                        {t(`reds.${grape}.name`)}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {t(`reds.${grape}.description`)}
                      </p>
                      <div className="mt-4 space-y-2">
                        <p className="text-sm">
                          <span className="font-medium text-slate-900">
                            {t('labels.tasting')}:
                          </span>{' '}
                          <span className="text-slate-600">
                            {t(`reds.${grape}.tasting`)}
                          </span>
                        </p>
                        <p className="text-sm">
                          <span className="font-medium text-slate-900">
                            {t('labels.pairing')}:
                          </span>{' '}
                          <span className="text-slate-600">
                            {t(`reds.${grape}.pairing`)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
