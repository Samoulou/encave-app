import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import heroBannerImage from '@/../public/images/herobanner-image.jpg';
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
import { HomeMobileEditorial } from '@/components/features/home/HomeMobileEditorial';
import { FadeIn } from '@/components/shared/FadeIn';
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
  const t = await getTranslations('home');

  const baseUrl = getBaseUrl();

  // Use the same published experience source as the listing page so the mobile
  // home never shows an empty rail while /experiences has real inventory.
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
          <div className="md:hidden">
            <HomeMobileEditorial experiences={featuredExperiences} />
          </div>

          {/* Hero Section with Background Image */}
          <section className="relative hidden h-[350px] w-full items-center justify-center overflow-hidden sm:h-[450px] md:flex md:h-[500px] lg:h-[600px]">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
              {/* Gradient Overlay */}
              <div
                className="absolute inset-0 z-10"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(32, 18, 22, 0.4) 0%, rgba(150, 42, 72, 0.5) 100%)',
                }}
              />
              <Image
                src={heroBannerImage}
                alt={t('heroImageAlt')}
                fill
                className="object-cover object-center"
                priority
                placeholder="blur"
                sizes="100vw"
                quality={60}
              />
            </div>

            {/* Hero Content */}
            <div className="relative z-20 w-full max-w-4xl px-4 text-center">
              <h1 className="mb-6 font-display text-4xl font-light leading-[1.08] tracking-tight text-white drop-shadow-sm md:text-5xl lg:text-7xl">
                {t.rich('heroTitle', {
                  strong: (chunks) => (
                    <strong className="font-bold">{chunks}</strong>
                  ),
                  em: (chunks) => <em className="text-gold-300">{chunks}</em>,
                })}
              </h1>
              <p className="mx-auto mb-10 max-w-2xl text-lg font-medium text-white/90 drop-shadow-sm md:text-xl">
                {t('heroSubtitle')}
              </p>

              {/* Search Bar */}
              <HeroSearchBar />
            </div>
          </section>

          <div className="mx-auto hidden max-w-7xl space-y-24 px-4 py-16 sm:px-6 md:block lg:px-8">
            {/* Popular Experiences Section */}
            <FadeIn>
              <PopularExperiences experiences={featuredExperiences} />
            </FadeIn>

            {/* How It Works Section */}
            <FadeIn>
              <HowItWorks />
            </FadeIn>

            {/* CTA Banner Section */}
            <FadeIn>
              <section className="relative overflow-hidden rounded-3xl">
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
                  <h2 className="mb-6 font-display text-3xl font-extrabold text-white md:text-5xl">
                    {t('ctaTitle')}
                  </h2>
                  <p className="mx-auto mb-8 max-w-xl text-lg text-white/80">
                    {t('ctaSubtitle')}
                  </p>
                  <div className="flex flex-col justify-center gap-4 sm:flex-row">
                    <Button
                      size="lg"
                      asChild
                      className="bg-primary shadow-lg hover:bg-[hsl(var(--primary-hover))]"
                    >
                      <Link href="/experiences">{t('ctaButton')}</Link>
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      asChild
                      className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                    >
                      <Link href="/register?winemaker=true">
                        {t('becomePartner')}
                      </Link>
                    </Button>
                  </div>
                </div>
              </section>
            </FadeIn>

            {/* Health Status (for development) */}
            <div className="mt-8 flex justify-center">
              <HealthStatus />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
