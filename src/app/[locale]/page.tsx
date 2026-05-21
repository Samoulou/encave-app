import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JsonLd } from '@/components/shared/JsonLd';
import { generateHomeMetadata } from '@/lib/seo';
import { getBaseUrl } from '@/lib/env';
import { HomeMobileEditorial } from '@/components/features/home/HomeMobileEditorial';
import { HomeDesktopEditorial } from '@/components/features/home/HomeDesktopEditorial';
import { HomeZeroInventoryTour } from '@/components/features/home/HomeZeroInventoryTour';
import { searchExperiences } from '@/server/queries/experience.queries';
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

  const baseUrl = getBaseUrl();

  // Use the same published experience source as the listing page so the
  // editorial home stays aligned with real inventory.
  const { experiences: featuredExperiences } = await searchExperiences({
    limit: 8,
  });

  // SEO-003: Organization schema for home page
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: 'EnCave',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description:
      "Plateforme de réservation d'expériences viticoles en Valais, Suisse. Découvrez et réservez des dégustations de vin, visites de caves et expériences œnologiques authentiques.",
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
        <div className="hidden md:block">
          <Header />
        </div>

        <main id="main-content">
          {featuredExperiences.length === 0 ? (
            <HomeZeroInventoryTour />
          ) : (
            <>
              <div className="md:hidden">
                <HomeMobileEditorial experiences={featuredExperiences} />
              </div>

              <div className="hidden md:block">
                <HomeDesktopEditorial experiences={featuredExperiences} />
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
}
