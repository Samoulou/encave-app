import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, MapPin, Phone, Mail, Calendar, ExternalLink, Wine } from 'lucide-react';
import { getWineryBySlug } from '@/server/queries/winery.queries';
import { VerifiedBadge } from '@/components/shared/VerifiedBadge';
import { JsonLd } from '@/components/shared/JsonLd';
import { generateWineryDetailMetadata } from '@/lib/seo';
import { getBaseUrl } from '@/lib/env';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';
import type { Locale } from '@/i18n/routing';

interface WineryPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: WineryPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const winery = await getWineryBySlug(slug);

  if (!winery) {
    return { title: 'Winery Not Found | EnCave' };
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
  const { slug } = await params;
  const winery = await getWineryBySlug(slug);

  if (!winery) {
    notFound();
  }

  const isVerified = winery.status === 'VERIFIED';
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${winery.address}, ${winery.commune}, Valais, Switzerland`)}`;
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
    ...(winery.latitude && winery.longitude && {
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
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-burgundy-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all wineries
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8">
              <h2 className="font-display text-xl font-semibold text-slate-900">
                About the Winery
              </h2>
              <div className="mt-4 prose prose-slate max-w-none">
                <p className="whitespace-pre-wrap text-slate-600 leading-relaxed">
                  {winery.description}
                </p>
              </div>
            </section>

            {/* Gallery */}
            {winery.galleryImages.length > 0 && (
              <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8">
                <h2 className="font-display text-xl font-semibold text-slate-900">
                  Gallery
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
                Contact
              </h2>
              <div className="mt-4 space-y-4">
                {/* Phone */}
                <a
                  href={`tel:${winery.phone}`}
                  className="flex items-center gap-3 text-sm text-slate-700 hover:text-burgundy-700 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-50">
                    <Phone className="h-5 w-5 text-burgundy-600" />
                  </div>
                  <span>{winery.phone}</span>
                </a>

                {/* Email */}
                <a
                  href={`mailto:${winery.email}`}
                  className="flex items-center gap-3 text-sm text-slate-700 hover:text-burgundy-700 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-50">
                    <Mail className="h-5 w-5 text-burgundy-600" />
                  </div>
                  <span className="break-all">{winery.email}</span>
                </a>

                {/* Address with map link */}
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-sm text-slate-700 hover:text-burgundy-700 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-burgundy-50">
                    <MapPin className="h-5 w-5 text-burgundy-600" />
                  </div>
                  <div className="pt-2">
                    <p>{winery.address}</p>
                    <p>{winery.commune}, Valais</p>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-burgundy-600">
                      View on map <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </a>
              </div>
            </div>

            {/* Coming Soon Teaser */}
            <div className="rounded-xl border-2 border-dashed border-gold-300 bg-gradient-to-br from-gold-50 to-gold-100/50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-400/20">
                <Calendar className="h-6 w-6 text-gold-700" />
              </div>
              <h3 className="mt-4 font-display font-semibold text-gold-900">
                Coming soon: Book experiences
              </h3>
              <p className="mt-2 text-sm text-gold-800">
                Wine tastings and tours will be available for booking soon.
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
