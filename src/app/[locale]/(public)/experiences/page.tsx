import { Suspense } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { type SearchParams } from '@/server/queries/experience.queries';
import { ExperiencesContent } from './ExperiencesContent';
import {
  DEFAULT_CATALOG_SORT,
  parseCatalogSort,
  parseDateKeyParam,
  parseExperienceTypes,
} from '@/lib/utils/search-params';
import {
  SkeletonExperienceGrid,
  Skeleton,
  SkeletonContainer,
} from '@/components/shared/Skeleton';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import type { Metadata } from 'next';

// Static metadata - no async, instant navigation!
export const metadata: Metadata = {
  title: 'Wine Experiences in Valais | EnCave',
  description:
    'Discover unique wine tasting experiences, cellar visits, and vineyard tours in the Swiss Alps.',
};

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    type?: string | string[];
    commune?: string;
    minPrice?: string;
    maxPrice?: string;
    capacity?: string;
    sort?: string;
    page?: string;
    // Date search (P-05 / L-110): YYYY-MM-DD, quand_fin optional range end
    quand?: string;
    quand_fin?: string;
    // Location-based search params
    location?: string;
    lat?: string;
    lng?: string;
  }>;
}

export default async function ExperiencesPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const searchParamsData = await searchParams;
  const t = await getTranslations('search');
  const tNav = await getTranslations('nav');
  const hasLocationSearch = Boolean(
    searchParamsData.location && searchParamsData.lat && searchParamsData.lng
  );

  // Parse search parameters (fast - no DB calls, no async)
  const page = searchParamsData.page ? parseInt(searchParamsData.page, 10) : 1;
  const types = parseExperienceTypes(searchParamsData.type);
  const sort = parseCatalogSort(searchParamsData.sort);
  // Date window (P-05 / L-110): quand anchors the window, quand_fin is an
  // optional inclusive end (weekend chip). A backwards range is dropped.
  const availableFrom = parseDateKeyParam(searchParamsData.quand);
  const rawAvailableTo = parseDateKeyParam(searchParamsData.quand_fin);
  const availableTo =
    availableFrom !== undefined &&
    rawAvailableTo !== undefined &&
    rawAvailableTo >= availableFrom
      ? rawAvailableTo
      : undefined;
  const parsedParams: SearchParams = {
    search: searchParamsData.q || undefined,
    type: types.length > 0 ? types : undefined,
    commune: searchParamsData.commune || undefined,
    minPrice: searchParamsData.minPrice
      ? parseInt(searchParamsData.minPrice, 10)
      : undefined,
    maxPrice: searchParamsData.maxPrice
      ? parseInt(searchParamsData.maxPrice, 10)
      : undefined,
    capacity: searchParamsData.capacity
      ? parseInt(searchParamsData.capacity, 10)
      : undefined,
    sort:
      sort === 'distance' && !hasLocationSearch ? DEFAULT_CATALOG_SORT : sort,
    page: page > 0 ? page : 1,
    availableFrom,
    availableTo,
    // Location-based search params
    location: searchParamsData.location || undefined,
    lat: searchParamsData.lat ? parseFloat(searchParamsData.lat) : undefined,
    lng: searchParamsData.lng ? parseFloat(searchParamsData.lng) : undefined,
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <Header />

      {/* Hero Section with background image */}
      <section className="relative min-h-[280px] w-full sm:min-h-[320px]">
        <Image
          src="/images/herobanner-image-v2.jpg"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-burgundy-950/80 via-burgundy-900/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
          <div className="mx-auto max-w-7xl">
            {/* Back to Home Link */}
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-cream-100 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {tNav('backToHome')}
            </Link>

            {/* Page Title */}
            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              {t('wineExperiences')}
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-white/90">
              {t('discoverExperiences')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Content with data - streams in when ready */}
        <Suspense fallback={<ContentLoadingState />}>
          <ExperiencesContent searchParams={parsedParams} />
        </Suspense>
      </div>
      <Footer />
    </div>
  );
}

/**
 * Skeleton shown while ExperiencesContent fetches data.
 * Header is NOT included since it renders immediately above.
 * Uses SkeletonContainer for proper accessibility (aria-busy, screen reader text).
 */
function ContentLoadingState() {
  return (
    <SkeletonContainer
      label="Loading wine experiences..."
      className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8"
    >
      {/* Sidebar filters skeleton (desktop) */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-6 rounded-xl border border-stone-200 bg-white p-6">
          <Skeleton className="h-6 w-20" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-6 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="space-y-6">
        {/* Search bar skeleton */}
        <Skeleton className="h-12 w-full" />

        {/* Results header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Grid skeleton */}
        <SkeletonExperienceGrid count={6} />
      </main>
    </SkeletonContainer>
  );
}
