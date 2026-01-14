import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getExperienceBySlug,
  getRelatedExperiences,
  getAllPublishedExperienceSlugs,
} from '@/server/queries/experience.queries';
import { ExperienceHero } from '@/components/features/experience/ExperienceHero';
import { ExperienceGallery } from '@/components/features/experience/ExperienceGallery';
import { ExperienceDetails } from '@/components/features/experience/ExperienceDetails';
import { AvailabilityPreview } from '@/components/features/experience/AvailabilityPreview';
import { WineryInfoCard } from '@/components/features/experience/WineryInfoCard';
import { LocationSection } from '@/components/features/experience/LocationSection';
import { BookingCTA } from '@/components/features/experience/BookingCTA';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { RelatedExperiences } from '@/components/features/experience/RelatedExperiences';
import { JsonLd } from '@/components/shared/JsonLd';
import { generateExperienceDetailMetadata } from '@/lib/seo';
import { getBaseUrl } from '@/lib/env';
import type { Locale } from '@/i18n/routing';

interface ExperiencePageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPublishedExperienceSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ExperiencePageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const experience = await getExperienceBySlug(slug);

  if (!experience) {
    return { title: 'Experience Not Found | EnCave' };
  }

  return generateExperienceDetailMetadata(
    locale as Locale,
    slug,
    experience.title,
    experience.description,
    experience.coverPhoto
  );
}

export default async function ExperiencePage({ params }: ExperiencePageProps) {
  const { slug } = await params;
  const experience = await getExperienceBySlug(slug);

  if (!experience) {
    notFound();
  }

  const relatedExperiences = await getRelatedExperiences(
    experience.id,
    experience.wineryId,
    experience.type,
    3
  );

  const baseUrl = getBaseUrl();

  // SEO-002: Calculate next available date from availability slots
  const getNextAvailableDate = () => {
    if (!experience.availabilitySlots || experience.availabilitySlots.length === 0) {
      return null;
    }

    const now = new Date();
    const availableDays = experience.availabilitySlots
      .filter((slot) => slot.isActive)
      .map((slot) => slot.dayOfWeek);

    if (availableDays.length === 0) return null;

    // Find next available day (0 = Sunday, 1 = Monday, etc.)
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + i);
      const dayOfWeek = checkDate.getDay();
      if (availableDays.includes(dayOfWeek)) {
        // Get the first time slot for that day
        const slot = experience.availabilitySlots.find(
          (s) => s.dayOfWeek === dayOfWeek && s.isActive
        );
        if (slot) {
          const [hoursStr, minutesStr] = slot.startTime.split(':');
          const hours = parseInt(hoursStr ?? '10', 10);
          const minutes = parseInt(minutesStr ?? '0', 10);
          checkDate.setHours(hours, minutes, 0, 0);
          return checkDate;
        }
      }
    }
    return null;
  };

  const nextAvailableDate = getNextAvailableDate();

  // SEO-002: Schema.org Event structured data with complete fields
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${baseUrl}/experiences/${experience.slug}`,
    name: experience.title,
    description: experience.description,
    image: experience.coverPhoto,
    url: `${baseUrl}/experiences/${experience.slug}`,
    ...(nextAvailableDate && {
      startDate: nextAvailableDate.toISOString(),
      endDate: new Date(
        nextAvailableDate.getTime() + experience.duration * 60000
      ).toISOString(),
    }),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: experience.winery.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: experience.winery.address,
        addressLocality: experience.winery.commune,
        addressRegion: 'Valais',
        addressCountry: 'CH',
      },
      ...(experience.winery.latitude && experience.winery.longitude && {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: experience.winery.latitude,
          longitude: experience.winery.longitude,
        },
      }),
    },
    offers: {
      '@type': 'Offer',
      price: experience.price / 100,
      priceCurrency: 'CHF',
      availability: 'https://schema.org/InStock',
      url: `${baseUrl}/experiences/${experience.slug}`,
      validFrom: new Date().toISOString(),
    },
    organizer: {
      '@type': 'Organization',
      name: experience.winery.name,
      url: `${baseUrl}/wineries/${experience.winery.slug}`,
    },
    performer: {
      '@type': 'Organization',
      name: experience.winery.name,
    },
    maximumAttendeeCapacity: experience.maxCapacity,
    remainingAttendeeCapacity: experience.maxCapacity, // Full capacity shown (bookings are per-slot)
  };

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Experiences', href: '/experiences' },
    { label: experience.title },
  ];

  return (
    <>
      <JsonLd data={eventSchema} />

      <div className="min-h-screen bg-cream-50">
        <ExperienceHero
          title={experience.title}
          type={experience.type}
          price={experience.price}
          coverPhoto={experience.coverPhoto}
        />

        {/* Breadcrumb */}
        <div className="border-b border-stone-200/60 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 lg:px-8">
            <Breadcrumb items={breadcrumbItems} />
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Experience Details */}
              <ExperienceDetails
                description={experience.description}
                duration={experience.duration}
                minCapacity={experience.minCapacity}
                maxCapacity={experience.maxCapacity}
              />

              {/* Availability Preview */}
              <AvailabilityPreview slots={experience.availabilitySlots} />

              {/* Gallery */}
              {experience.galleryImages.length > 0 && (
                <ExperienceGallery
                  images={experience.galleryImages}
                  experienceTitle={experience.title}
                />
              )}

              {/* Location Section */}
              <LocationSection
                address={experience.winery.address}
                commune={experience.winery.commune}
                wineryName={experience.winery.name}
                latitude={experience.winery.latitude}
                longitude={experience.winery.longitude}
              />
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Booking CTA */}
              <BookingCTA
                price={experience.price}
                experienceSlug={experience.slug}
                stripeConnected={experience.winery.stripeOnboardingComplete}
              />

              {/* Winery Info Card */}
              <WineryInfoCard
                name={experience.winery.name}
                slug={experience.winery.slug}
                commune={experience.winery.commune}
                coverPhoto={experience.winery.coverPhoto}
              />
            </div>
          </div>

          {/* Related Experiences */}
          {relatedExperiences.length > 0 && (
            <div className="mt-16">
              <RelatedExperiences experiences={relatedExperiences} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
