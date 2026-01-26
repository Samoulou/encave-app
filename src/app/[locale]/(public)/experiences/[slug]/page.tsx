import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import {
  getExperienceBySlug,
  getAllPublishedExperienceSlugs,
} from '@/server/queries/experience.queries';
import { ExperienceDetailHeader } from '@/components/features/experience/ExperienceDetailHeader';
import { ExperienceDetailGallery } from '@/components/features/experience/ExperienceDetailGallery';
import { QuickFacts } from '@/components/features/experience/QuickFacts';
import { AboutSection } from '@/components/features/experience/AboutSection';
import { WhatsIncluded } from '@/components/features/experience/WhatsIncluded';
import { LocationSection } from '@/components/features/experience/LocationSection';
import { BookingWidget } from '@/components/features/experience/BookingWidget';
import { MobileBookingBar } from '@/components/features/experience/MobileBookingBar';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { RelatedExperiencesSection } from './RelatedExperiencesSection';
import { JsonLd } from '@/components/shared/JsonLd';
import { Skeleton } from '@/components/shared/Skeleton';
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
    <div className="min-h-screen bg-background-light">
      <Header />
      <JsonLd data={eventSchema} />

      <main className="flex-grow w-full pb-24 lg:pb-8">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumbs */}
          <nav className="flex items-center text-sm mb-6 overflow-x-auto whitespace-nowrap">
            <Breadcrumb items={breadcrumbItems} baseUrl={baseUrl} />
          </nav>

          {/* Page Heading & Rating */}
          <ExperienceDetailHeader
            title={experience.title}
            wineryName={experience.winery.name}
            winerySlug={experience.winery.slug}
            commune={experience.winery.commune}
          />

          {/* Image Gallery Grid */}
          <ExperienceDetailGallery
            coverPhoto={experience.coverPhoto}
            images={experience.galleryImages}
            experienceTitle={experience.title}
          />

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative">
            {/* Left Column: Details (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-10">
              {/* Quick Facts Chips */}
              <QuickFacts
                duration={experience.duration}
                maxCapacity={experience.maxCapacity}
                type={experience.type}
              />

              {/* About Section */}
              <AboutSection description={experience.description} />

              {/* What's Included */}
              <WhatsIncluded type={experience.type} />

              {/* Location Map */}
              <LocationSection
                address={experience.winery.address}
                commune={experience.winery.commune}
                wineryName={experience.winery.name}
                latitude={experience.winery.latitude}
                longitude={experience.winery.longitude}
              />
            </div>

            {/* Right Column: Sticky Booking Widget (4 cols) */}
            <div className="lg:col-span-4 relative hidden lg:block">
              <BookingWidget
                price={experience.price}
                experienceSlug={experience.slug}
                experienceId={experience.id}
                stripeConnected={experience.winery.stripeOnboardingComplete}
                minCapacity={experience.minCapacity}
                maxCapacity={experience.maxCapacity}
                availabilitySlots={experience.availabilitySlots}
              />
            </div>
          </div>

          {/* Related Experiences - streams in after main content */}
          <Suspense fallback={<RelatedExperiencesSkeleton />}>
            <RelatedExperiencesSection
              experienceId={experience.id}
              wineryId={experience.wineryId}
              experienceType={experience.type}
            />
          </Suspense>
        </div>

        {/* Mobile Booking Bar */}
        <MobileBookingBar
          price={experience.price}
          experienceSlug={experience.slug}
          experienceId={experience.id}
          stripeConnected={experience.winery.stripeOnboardingComplete}
          minCapacity={experience.minCapacity}
          maxCapacity={experience.maxCapacity}
          availabilitySlots={experience.availabilitySlots}
        />
      </main>
      <Footer />
    </div>
  );
}

function RelatedExperiencesSkeleton() {
  return (
    <div className="mt-16">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl bg-white shadow-warm">
            <Skeleton className="h-48 w-full" />
            <div className="p-5">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
