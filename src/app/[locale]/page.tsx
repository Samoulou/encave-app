import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HealthStatus } from '@/components/shared/HealthStatus';
import { Button } from '@/components/ui/button';
import { JsonLd } from '@/components/shared/JsonLd';
import { generateHomeMetadata } from '@/lib/seo';
import { getBaseUrl } from '@/lib/env';
import { HeroSearchBar } from '@/components/features/home/HeroSearchBar';
import { PopularExperiences } from '@/components/features/home/PopularExperiences';
import { HowItWorks } from '@/components/features/home/HowItWorks';
import { getFeaturedExperiences } from '@/server/queries/experience.queries';
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

  // Fetch featured experiences for the homepage
  const featuredExperiences = await getFeaturedExperiences(3);

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
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section with Background Image */}
      <section className="relative h-[500px] md:h-[600px] w-full flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          {/* Gradient Overlay */}
          <div
            className="absolute inset-0 z-10"
            style={{
              background: 'linear-gradient(135deg, rgba(32, 18, 22, 0.4) 0%, rgba(205, 45, 85, 0.5) 100%)',
            }}
          />
          <Image
            src="https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1920&auto=format&fit=crop"
            alt={t('heroImageAlt')}
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-20 w-full max-w-4xl px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight drop-shadow-sm">
            {t('heroTitle')} <span className="text-secondary">{t('heroTitleHighlight')}</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-10 max-w-2xl mx-auto font-medium drop-shadow-sm">
            {t('heroSubtitle')}
          </p>

          {/* Search Bar */}
          <HeroSearchBar />
        </div>
      </section>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24">
        {/* Popular Experiences Section */}
        <PopularExperiences experiences={featuredExperiences} />

        {/* How It Works Section */}
        <HowItWorks />

        {/* CTA Banner Section */}
        <section className="relative rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-[#201216]">
            <Image
              src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1920&auto=format&fit=crop"
              alt={t('ctaImageAlt')}
              fill
              className="object-cover opacity-40 mix-blend-overlay"
              sizes="100vw"
            />
          </div>
          <div className="relative z-10 px-6 py-20 text-center">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
              {t('ctaTitle')}
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              {t('ctaSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="bg-primary hover:bg-[#a62444] shadow-lg">
                <Link href="/experiences">
                  {t('ctaButton')}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border-white/30"
              >
                <Link href="/register?winemaker=true">
                  {t('becomePartner')}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Health Status (for development) */}
        <div className="mt-8 flex justify-center">
          <HealthStatus />
        </div>
      </main>
      <Footer />
    </div>
    </>
  );
}
