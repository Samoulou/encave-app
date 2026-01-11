import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  searchExperiences,
  getExperienceCommunes,
  type SearchParams,
} from '@/server/queries/experience.queries';
import { ExperiencesPageClient } from './ExperiencesPageClient';
import { ExperienceType } from '@prisma/client';
import { generateExperiencesMetadata } from '@/lib/seo';
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
  }>;
}

export default async function ExperiencesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('search');
  const searchParamsData = await searchParams;

  // Parse search parameters
  const parsedParams: SearchParams = {
    search: searchParamsData.q || undefined,
    type: parseTypeParam(searchParamsData.type),
    commune: searchParamsData.commune || undefined,
    minPrice: searchParamsData.minPrice ? parseInt(searchParamsData.minPrice, 10) : undefined,
    maxPrice: searchParamsData.maxPrice ? parseInt(searchParamsData.maxPrice, 10) : undefined,
    capacity: searchParamsData.capacity ? parseInt(searchParamsData.capacity, 10) : undefined,
    sort: parseSort(searchParamsData.sort),
  };

  // Fetch data in parallel
  const [experiences, communes] = await Promise.all([
    searchExperiences(parsedParams),
    getExperienceCommunes(),
  ]);

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
            {t('wineExperiences')}
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            {t('discoverExperiences')}
          </p>
        </div>

        {/* Search Page Content */}
        <Suspense fallback={<LoadingState />}>
          <ExperiencesPageClient
            initialExperiences={experiences}
            communes={communes}
          />
        </Suspense>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-burgundy-200 border-t-burgundy-600" />
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
