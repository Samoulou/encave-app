import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getExperienceBySlug } from '@/server/queries/experience.queries';
import { ExperienceDetailGallery } from '@/components/features/experience/ExperienceDetailGallery';
import { LocationSection } from '@/components/features/experience/LocationSection';
import { BookingWidget } from '@/components/features/experience/BookingWidget';
import { MobileBookingBar } from '@/components/features/experience/MobileBookingBar';
import { ExperienceDetailActions } from '@/components/features/experience/ExperienceDetailActions';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { RelatedExperiencesSection } from './RelatedExperiencesSection';
import { JsonLd } from '@/components/shared/JsonLd';
import { Skeleton } from '@/components/shared/Skeleton';
import { generateExperienceDetailMetadata } from '@/lib/seo';
import { getBaseUrl } from '@/lib/env';
import { type Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { ArrowUpRight, Check, Clock, Globe2, Users, Wine } from 'lucide-react';

interface ExperiencePageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: ExperiencePageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const experience = await getExperienceBySlug(slug);

  if (!experience) {
    const t = await getTranslations({ locale, namespace: 'experience' });
    return { title: `${t('notFound')} | EnCave` };
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
  const { slug, locale } = await params;
  setRequestLocale(locale);

  const experience = await getExperienceBySlug(slug);

  if (!experience) {
    notFound();
  }

  const t = await getTranslations('experience');
  const tNav = await getTranslations('nav');

  const baseUrl = getBaseUrl();
  const nextAvailableDate = getNextAvailableDate(
    experience.availabilitySlots,
    experience.duration
  );

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
        streetAddress: experience.address || experience.winery.address,
        addressLocality: experience.city || experience.winery.commune,
        postalCode: experience.zipCode || undefined,
        addressRegion: 'Valais',
        addressCountry: 'CH',
      },
      ...((experience.latitude || experience.winery.latitude) &&
        (experience.longitude || experience.winery.longitude) && {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: experience.latitude || experience.winery.latitude,
            longitude: experience.longitude || experience.winery.longitude,
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
    remainingAttendeeCapacity: experience.maxCapacity,
  };

  const breadcrumbItems = [
    { label: tNav('home'), href: '/' },
    { label: tNav('experiences'), href: '/experiences' },
    { label: experience.title },
  ];
  const locationAddress = experience.address || experience.winery.address;
  const locationCommune = experience.city || experience.winery.commune;
  const durationLabel = formatDuration(experience.duration);
  const paragraphs = experience.description.split('\n\n').filter(Boolean);
  const experienceTypeLabel = t(`types.${experience.type}`);
  const practicalItems = [
    t('detail.durationIndicated', { duration: durationLabel }),
    t('detail.groupSize', {
      min: experience.minCapacity,
      max: experience.maxCapacity,
    }),
    t('detail.meetingPoint', { commune: locationCommune }),
    t('detail.proposedBy', {
      type: experienceTypeLabel,
      winery: experience.winery.name,
    }),
    experience.winery.stripeOnboardingComplete
      ? t('detail.securePaymentActive')
      : t('detail.bookingToConfirm'),
  ];

  return (
    <div className="min-h-screen bg-cream-50 text-ink-900">
      <Header />
      <JsonLd data={eventSchema} />

      <main className="w-full flex-grow pb-24 lg:pb-8">
        <div className="border-b border-stone-200 bg-white px-4 py-3 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
            <nav className="min-w-0 overflow-x-auto whitespace-nowrap text-xs text-ink-500">
              <span className="hidden lg:inline">
                {t('detail.explore')} &gt; {experienceTypeLabel} &gt;{' '}
                <strong className="font-semibold text-ink-900">
                  {experience.title}
                </strong>
              </span>
              <span className="lg:hidden">
                <Breadcrumb items={breadcrumbItems} baseUrl={baseUrl} />
              </span>
            </nav>
            <ExperienceDetailActions />
          </div>
        </div>

        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:pb-14 lg:pt-5">
          <ExperienceDetailGallery
            coverPhoto={experience.coverPhoto}
            images={experience.galleryImages}
            experienceTitle={experience.title}
          />

          <div className="relative grid grid-cols-1 gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span
                  className="rounded-full bg-burgundy-50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-burgundy-700"
                  data-testid="experience-capacity"
                >
                  {t('detail.placesMax', { count: experience.maxCapacity })}
                </span>
              </div>
              <h1 className="max-w-3xl font-display text-[2.35rem] font-medium leading-[1.05] tracking-[-0.015em] text-ink-900 sm:text-[2.9rem]">
                {experience.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
                <Link
                  href={`/wineries/${experience.winery.slug}`}
                  className="font-semibold text-burgundy-700 hover:underline"
                >
                  {experience.winery.name}
                </Link>
                <span>·</span>
                <span>{locationCommune}</span>
                <span>·</span>
                <span>Valais</span>
              </div>

              <div className="my-7 grid gap-4 border-y border-stone-200 py-5 sm:grid-cols-2 lg:grid-cols-4">
                <MetaFact
                  icon={<Clock className="h-[18px] w-[18px]" />}
                  label={t('duration')}
                  value={durationLabel}
                  testId="experience-duration"
                />
                <MetaFact
                  icon={<Users className="h-[18px] w-[18px]" />}
                  label={t('detail.group')}
                  value={t('detail.groupValue', {
                    min: experience.minCapacity,
                    max: experience.maxCapacity,
                  })}
                />
                <MetaFact
                  icon={<Wine className="h-[18px] w-[18px]" />}
                  label={t('detail.format')}
                  value={experienceTypeLabel}
                  testId="experience-type-badge"
                />
                <MetaFact
                  icon={<Globe2 className="h-[18px] w-[18px]" />}
                  label={t('detail.place')}
                  value={locationCommune}
                />
              </div>

              <div
                className="mb-8 flex items-center gap-4 rounded-[14px] border border-stone-200 bg-white p-4 shadow-audit-card"
                data-testid="winery-info-card"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-cream-200">
                  <ImageWithFallback
                    src={experience.winery.coverPhoto || experience.coverPhoto}
                    alt={experience.winery.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-500">
                    {tNav('yourWinery')}
                  </div>
                  <div
                    className="font-display text-lg font-semibold text-ink-900"
                    data-testid="winery-name"
                  >
                    {experience.winery.name}
                  </div>
                  <div
                    className="truncate text-xs text-ink-500"
                    data-testid="winery-location"
                  >
                    {locationAddress} · {locationCommune}
                  </div>
                </div>
                <Link
                  href={`/wineries/${experience.winery.slug}`}
                  className="hidden h-9 items-center gap-1 rounded-full border border-stone-200 px-4 text-xs font-semibold text-ink-700 transition-colors hover:border-burgundy-200 hover:text-burgundy-700 sm:inline-flex"
                >
                  {t('detail.viewProfile')}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <section data-testid="experience-description">
                <h2 className="mb-3 font-display text-2xl font-semibold text-ink-900">
                  {t('detail.theExperience')}
                </h2>
                <div className="max-w-3xl space-y-4 text-[15px] leading-7 text-ink-700">
                  {paragraphs.length > 0 ? (
                    paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))
                  ) : (
                    <p>{experience.description}</p>
                  )}
                </div>
              </section>

              <section className="mt-9">
                <h2 className="mb-4 font-display text-2xl font-semibold text-ink-900">
                  {t('detail.practicalInfo')}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {practicalItems.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm text-ink-700"
                    >
                      <Check className="h-4 w-4 shrink-0 text-vine" />
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-10">
                <LocationSection
                  address={locationAddress}
                  commune={locationCommune}
                  wineryName={experience.winery.name}
                  winerySlug={experience.winery.slug}
                  latitude={experience.latitude || experience.winery.latitude}
                  longitude={
                    experience.longitude || experience.winery.longitude
                  }
                />
              </div>

              <Suspense fallback={<RelatedExperiencesSkeleton />}>
                <RelatedExperiencesSection
                  experienceId={experience.id}
                  wineryId={experience.wineryId}
                  experienceType={experience.type}
                />
              </Suspense>
            </div>

            <div className="relative hidden lg:block">
              <BookingWidget
                price={experience.price}
                experienceSlug={experience.slug}
                experienceId={experience.id}
                stripeConnected={experience.winery.stripeOnboardingComplete}
                minCapacity={experience.minCapacity}
                maxCapacity={experience.maxCapacity}
                duration={experience.duration}
                availabilitySlots={experience.availabilitySlots}
              />
            </div>
          </div>
        </div>

        <MobileBookingBar
          price={experience.price}
          experienceSlug={experience.slug}
          experienceId={experience.id}
          stripeConnected={experience.winery.stripeOnboardingComplete}
          minCapacity={experience.minCapacity}
          maxCapacity={experience.maxCapacity}
          duration={experience.duration}
          availabilitySlots={experience.availabilitySlots}
        />
      </main>
      <Footer />
    </div>
  );
}

function MetaFact({
  icon,
  label,
  value,
  testId,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-burgundy-700">{icon}</div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-500">
          {label}
        </div>
        <div
          className="mt-1 text-sm font-semibold text-ink-900"
          data-testid={testId}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function getNextAvailableDate(
  slots: Array<{ dayOfWeek: number; startTime: string; isActive: boolean }>,
  duration: number
) {
  if (!slots || slots.length === 0 || duration <= 0) return null;

  const now = new Date();
  const availableDays = slots
    .filter((slot) => slot.isActive)
    .map((slot) => slot.dayOfWeek);

  if (availableDays.length === 0) return null;

  for (let i = 0; i < 14; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() + i);
    const dayOfWeek = checkDate.getDay();
    if (availableDays.includes(dayOfWeek)) {
      const slot = slots.find(
        (candidate) => candidate.dayOfWeek === dayOfWeek && candidate.isActive
      );
      if (slot) {
        const [hoursStr, minutesStr] = slot.startTime.split(':');
        checkDate.setHours(
          parseInt(hoursStr ?? '10', 10),
          parseInt(minutesStr ?? '0', 10),
          0,
          0
        );
        return checkDate;
      }
    }
  }

  return null;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}` : `${hours}h`;
}

function RelatedExperiencesSkeleton() {
  return (
    <div className="mt-16">
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl bg-white shadow-warm"
          >
            <Skeleton className="h-48 w-full" />
            <div className="p-5">
              <Skeleton className="mb-2 h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
