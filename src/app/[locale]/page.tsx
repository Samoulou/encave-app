import { Sparkles, Building2, ArrowRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HealthStatus } from '@/components/shared/HealthStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JsonLd } from '@/components/shared/JsonLd';
import { generateHomeMetadata } from '@/lib/seo';
import { getBaseUrl } from '@/lib/env';
import { HeroSearch } from '@/components/features/home/HeroSearch';
import type { Locale } from '@/i18n/routing';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return generateHomeMetadata(locale as Locale);
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  const baseUrl = getBaseUrl();

  // SEO-003: Organization schema for home page
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: 'EnCave',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'Plateforme de réservation d\'expériences viticoles en Valais, Suisse. Découvrez et réservez des dégustations de vin, visites de caves et expériences œnologiques authentiques.',
    areaServed: {
      '@type': 'Place',
      name: 'Valais, Switzerland',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'Valais',
        addressCountry: 'CH',
      },
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'contact@encave.ch',
    },
  };

  return (
    <>
    <JsonLd data={organizationSchema} />
    <div className="min-h-screen bg-cream-50">
      <Header />

      {/* Hero Section with Background Image */}
      <section className="relative overflow-hidden bg-burgundy-900">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1920&auto=format&fit=crop')`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-burgundy-900/90 via-burgundy-800/85 to-burgundy-900/90" />
        </div>

        {/* Decorative pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Hero Content */}
        <div className="relative mx-auto max-w-6xl px-6 py-20 lg:px-8 lg:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-display-lg text-white mb-4 drop-shadow-lg">
              {t('title')}
            </h1>
            <p className="text-lg sm:text-xl text-cream-100/90 mb-10 max-w-2xl mx-auto">
              {t('subtitle')}
            </p>

            {/* Quick Search */}
            <HeroSearch placeholder={t('searchPlaceholder')} buttonText={t('searchButton')} />
          </div>
        </div>
      </section>

      <main id="main-content" className="flex flex-col items-center px-6 py-16 lg:px-8 lg:py-24">

        {/* Discovery Section */}
        <section className="w-full max-w-4xl mx-auto mb-16" aria-labelledby="discover-heading">
          <h2 id="discover-heading" className="sr-only">{t('discoverSection')}</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Experiences CTA */}
            <Card className="group overflow-hidden rounded-xl shadow-warm hover:-translate-y-1 hover:shadow-warm-lg transition-all duration-300">
              <CardContent className="p-0">
                <Link href="/experiences" className="block p-6 sm:p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-burgundy-100 text-burgundy-600 group-hover:bg-burgundy-600 group-hover:text-white transition-colors">
                      <Sparkles className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-slate-900">
                      {t('wineExperiences')}
                    </h3>
                  </div>
                  <p className="text-slate-600 mb-6">
                    {t('wineExperiencesDescription')}
                  </p>
                  <span className="inline-flex items-center gap-2 text-burgundy-600 font-medium group-hover:gap-3 transition-all">
                    {t('browseExperiences')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </CardContent>
            </Card>

            {/* Wineries CTA */}
            <Card className="group overflow-hidden rounded-xl shadow-warm hover:-translate-y-1 hover:shadow-warm-lg transition-all duration-300">
              <CardContent className="p-0">
                <Link href="/wineries" className="block p-6 sm:p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-burgundy-100 text-burgundy-600 group-hover:bg-burgundy-600 group-hover:text-white transition-colors">
                      <Building2 className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-slate-900">
                      {t('ourWineries')}
                    </h3>
                  </div>
                  <p className="text-slate-600 mb-6">
                    {t('ourWineriesDescription')}
                  </p>
                  <span className="inline-flex items-center gap-2 text-burgundy-600 font-medium group-hover:gap-3 transition-all">
                    {t('meetWinemakers')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-2xl sm:text-display-md text-slate-900 mb-4">
            {t('readyToExplore')}
          </h2>
          <p className="text-slate-600 mb-8">
            {t('startJourney')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/experiences">
                {t('viewAllExperiences')}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/register?winemaker=true">
                {t('becomePartner')}
              </Link>
            </Button>
          </div>
        </section>

        {/* Health Status (for development) */}
        <div className="mt-8">
          <HealthStatus />
        </div>
      </main>
      <Footer />
    </div>
    </>
  );
}
