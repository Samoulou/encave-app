import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type SearchParams } from '@/server/queries/experience.queries';
import { ExperiencesContent } from './ExperiencesContent';
import { ExperienceType } from '@prisma/client';
import { generateExperiencesMetadata } from '@/lib/seo';
import { SkeletonExperienceGrid, Skeleton } from '@/components/shared/Skeleton';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generateExperiencesMetadata(locale as Locale);
}

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
  }>;
}

export default async function ExperiencesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('search');
  const searchParamsData = await searchParams;

  // Parse search parameters (fast - no DB calls)
  const page = searchParamsData.page ? parseInt(searchParamsData.page, 10) : 1;
  const parsedParams: SearchParams = {
    search: searchParamsData.q || undefined,
    type: parseTypeParam(searchParamsData.type),
    commune: searchParamsData.commune || undefined,
    minPrice: searchParamsData.minPrice ? parseInt(searchParamsData.minPrice, 10) : undefined,
    maxPrice: searchParamsData.maxPrice ? parseInt(searchParamsData.maxPrice, 10) : undefined,
    capacity: searchParamsData.capacity ? parseInt(searchParamsData.capacity, 10) : undefined,
    sort: parseSort(searchParamsData.sort),
    page: page > 0 ? page : 1,
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header - renders immediately */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
            {t('wineExperiences')}
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            {t('discoverExperiences')}
          </p>
        </div>

        {/* Content with data - streams in when ready */}
        <Suspense fallback={<ContentLoadingState />}>
          <ExperiencesContent searchParams={parsedParams} />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Skeleton shown while ExperiencesContent fetches data.
 * Header is NOT included since it renders immediately above.
 */
function ContentLoadingState() {
  return (
    <div className="animate-pulse">
      {/* Search & filters skeleton */}
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-12 w-full lg:w-96" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Results count skeleton */}
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Grid skeleton */}
      <SkeletonExperienceGrid count={9} />
    </div>
  );
}

function parseTypeParam(
  type: string | string[] | undefined
): ExperienceType[] | undefined {
  if (!type) return undefined;
  const types = Array.isArray(type) ? type : type.split(',');
  const validTypes: ExperienceType[] = [
    'TASTING',
    'CELLAR_VISIT',
    'WORKSHOP',
    'VINEYARD_TOUR',
    'FOOD_PAIRING',
  ];
  const filtered = types.filter((t): t is ExperienceType =>
    validTypes.includes(t as ExperienceType)
  );
  return filtered.length > 0 ? filtered : undefined;
}

function parseSort(
  sort: string | undefined
): 'relevance' | 'price_asc' | 'price_desc' | 'newest' {
  const validSorts = ['relevance', 'price_asc', 'price_desc', 'newest'] as const;
  if (sort && validSorts.includes(sort as (typeof validSorts)[number])) {
    return sort as (typeof validSorts)[number];
  }
  return 'relevance';
}
