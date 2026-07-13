import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, MapPin, Phone, Mail, Calendar, Wine } from 'lucide-react';
import {
  getWineryBySlug,
  getPubliclyVisibleWinerySlugs,
} from '@/server/queries/winery.queries';
import { getExperiencesByWineryId } from '@/server/queries/experience.queries';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { formatCHF } from '@/lib/utils/currency';
import { RelatedExperiences } from '@/components/features/experience/RelatedExperiences';
import { VerifiedBadge } from '@/components/shared/VerifiedBadge';
import { JsonLd } from '@/components/shared/JsonLd';
import { generateWineryDetailMetadata } from '@/lib/seo';
import { getBaseUrl } from '@/lib/env';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { WineryLocationMap } from '@/components/features/winery/WineryLocationMap';
import { SurMesureBlock } from '@/components/features/requests/SurMesureBlock';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { MapWinery } from '@/components/features/map/types';

interface WineryPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

// P-06 (L-202): ISR — prerendered from the visible winery slugs,
// invalidated by BOTH tags this page consumes ('wineries' via
// getWineryBySlug, 'experiences' via getExperiencesByWineryId), 300 s
// TTL as safety net. dynamicParams covers wineries verified post-build.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getPubliclyVisibleWinerySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: WineryPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const winery = await getWineryBySlug(slug);

  if (!winery) {
    // Explicit locale: generateMetadata runs in its own pass, without
    // the page's setRequestLocale — an implicit call falls back to
    // headers() and kills static generation.
    const t = await getTranslations({ locale, namespace: 'winery' });
    return { title: `${t('notFoundTitle')} | EnCave` };
  }

  return generateWineryDetailMetadata(
    locale as Locale,
    slug,
    winery.name,
    winery.description,
    winery.coverPhoto ?? undefined
  );
}

export default async function WineryPage({ params }: WineryPageProps) {
  const { slug, locale } = await params;
  // Required for static rendering (ISR) with next-intl.
  setRequestLocale(locale);
  const [winery, t, tastingEnabled, requestsEnabled] = await Promise.all([
    getWineryBySlug(slug),
    getTranslations('winery'),
    isFlagEnabled('TASTING_SHEET'),
    isFlagEnabled('REQUESTS'),
  ]);

  if (!winery) {
    notFound();
  }

  // P-07 / L-064: public wine list, entirely behind the TASTING_SHEET flag.
  const wines = tastingEnabled ? (winery.wines ?? []) : [];

  const experiences = await getExperiencesByWineryId(winery.id);

  const isVerified = winery.status === 'VERIFIED';
  const baseUrl = getBaseUrl();

  // SEO-001: LocalBusiness structured data for rich snippets
  const winerySchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}/wineries/${winery.slug}`,
    name: winery.name,
    description: winery.description,
    image: winery.coverPhoto,
    telephone: winery.phone,
    email: winery.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: winery.address,
      addressLocality: winery.commune,
      addressRegion: 'Valais',
      addressCountry: 'CH',
    },
    ...(winery.latitude &&
      winery.longitude && {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: winery.latitude,
          longitude: winery.longitude,
        },
      }),
    url: `${baseUrl}/wineries/${winery.slug}`,
  };

  return (
    <>
      <JsonLd data={winerySchema} />
      <div className="min-h-screen bg-cream-50">
        <Header />
        {/* Hero Section */}
        <section className="relative h-[50vh] min-h-[400px] w-full">
          {winery.coverPhoto ? (
            <Image
              src={winery.coverPhoto}
              alt={winery.name}
              fill
              className="object-cover"
              priority
              sizes="100vw"
              placeholder="blur"
              blurDataURL={IMAGE_PLACEHOLDERS.hero}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-burgundy-700 to-burgundy-900">
              <div className="absolute inset-0 flex items-center justify-center">
                <Wine className="h-32 w-32 text-burgundy-500/30" />
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-burgundy-950/80 via-burgundy-900/30 to-transparent" />

          {/* Hero Content */}
          <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
            <div className="mx-auto max-w-6xl">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-display-lg text-white">
                  {winery.name}
                </h1>
                {isVerified && <VerifiedBadge size="lg" />}
              </div>
              <p className="mt-2 flex items-center gap-2 text-lg text-white/90">
                <MapPin className="h-5 w-5" />
                {winery.commune}, Valais
              </p>
            </div>
          </div>
        </section>

        {/* Back to directory link */}
        <div className="border-b border-stone-200/60 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 lg:px-8">
            <Link
              href="/wineries"
              className="inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-burgundy-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('backToAllWineries')}
            </Link>
          </div>
        </div>

        {/* Experiences Section */}
        {experiences.length > 0 && (
          <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
            <RelatedExperiences
              experiences={experiences}
              title={t('experiences')}
            />
          </div>
        )}

        {/* Content */}
        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main Content */}
            <div className="space-y-8 lg:col-span-2">
              {/* About */}
              <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8">
                <h2 className="font-display text-xl font-semibold text-slate-900">
                  {t('aboutTheWinery')}
                </h2>
                <div className="prose prose-slate mt-4 max-w-none">
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-600">
                    {winery.description}
                  </p>
                </div>
              </section>

              {/* Sur-mesure request block (P-10 / L-090) — verified wineries
                  only, entirely behind the REQUESTS flag. Pure client island
                  so it never breaks the ISR of this page. */}
              {isVerified && requestsEnabled && (
                <SurMesureBlock wineryId={winery.id} wineryName={winery.name} />
              )}

              {/* Wines (P-07 / L-064) */}
              {wines.length > 0 && (
                <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8">
                  <h2 className="font-display text-xl font-semibold text-slate-900">
                    {t('winesSectionTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('winesSectionSubtitle')}
                  </p>
                  <ul className="mt-4 divide-y divide-stone-100">
                    {wines.map((wine) => (
                      <li
                        key={wine.id}
                        className="flex items-baseline justify-between gap-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {wine.name}
                            {wine.vintage != null && (
                              <span className="ml-2 font-normal text-slate-500">
                                {wine.vintage}
                              </span>
                            )}
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {wine.grapeVariety}
                          </p>
                        </div>
                        <p className="shrink-0 font-display font-semibold text-burgundy-800">
                          {formatCHF(wine.price)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Gallery */}
              {winery.galleryImages.length > 0 && (
                <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8">
                  <h2 className="font-display text-xl font-semibold text-slate-900">
                    {t('gallery')}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {winery.galleryImages.map((image) => (
                      <div
                        key={image.id}
                        className="group relative aspect-square overflow-hidden rounded-lg"
                      >
                        <Image
                          src={image.url}
                          alt={`${winery.name} gallery`}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 50vw, 33vw"
                          placeholder="blur"
                          blurDataURL={IMAGE_PLACEHOLDERS.square}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact Card */}
              <div className="rounded-xl bg-white p-6 shadow-warm">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  {t('contact')}
                </h2>
                <div className="mt-4 space-y-4">
                  {/* Phone */}
                  <a
                    href={`tel:${winery.phone}`}
                    className="flex items-center gap-3 text-sm text-slate-700 transition-colors hover:text-burgundy-700"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-50">
                      <Phone className="h-5 w-5 text-burgundy-600" />
                    </div>
                    <span>{winery.phone}</span>
                  </a>

                  {/* Email */}
                  <a
                    href={`mailto:${winery.email}`}
                    className="flex items-center gap-3 text-sm text-slate-700 transition-colors hover:text-burgundy-700"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-50">
                      <Mail className="h-5 w-5 text-burgundy-600" />
                    </div>
                    <span className="break-all">{winery.email}</span>
                  </a>

                  {/* Address */}
                  <div className="flex items-start gap-3 text-sm text-slate-700">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-burgundy-50">
                      <MapPin className="h-5 w-5 text-burgundy-600" />
                    </div>
                    <div className="pt-2">
                      <p>{winery.address}</p>
                      <p>{winery.commune}, Valais</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Map */}
              {winery.latitude != null && winery.longitude != null && (
                <WineryLocationMap
                  winery={
                    {
                      id: winery.id,
                      name: winery.name,
                      slug: winery.slug,
                      commune: winery.commune,
                      coverPhoto: winery.coverPhoto,
                      latitude: winery.latitude,
                      longitude: winery.longitude,
                      _count: { experiences: 0 },
                    } satisfies MapWinery
                  }
                  address={winery.address}
                  commune={winery.commune}
                />
              )}

              {/* Experiences or Coming Soon */}
              {experiences.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gold-300 bg-gradient-to-br from-gold-50 to-gold-100/50 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-400/20">
                    <Calendar className="h-6 w-6 text-gold-700" />
                  </div>
                  <h3 className="mt-4 font-display font-semibold text-gold-900">
                    {t('comingSoonTitle')}
                  </h3>
                  <p className="mt-2 text-sm text-gold-800">
                    {t('comingSoonDescription')}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
