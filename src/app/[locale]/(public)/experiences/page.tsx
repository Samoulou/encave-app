import { Suspense } from 'react';
import { Metadata } from 'next';
import {
  searchExperiences,
  getExperienceCommunes,
  type SearchParams,
} from '@/server/queries/experience.queries';
import { ExperiencesPageClient } from './ExperiencesPageClient';
import { ExperienceType } from '@prisma/client';

export const metadata: Metadata = {
  title: 'Wine Experiences in Valais | EnCave',
  description:
    'Discover unique wine experiences in Valais, Switzerland. Book tastings, cellar visits, vineyard tours, and more from local winemakers.',
  openGraph: {
    title: 'Wine Experiences in Valais | EnCave',
    description:
      'Discover unique wine experiences in Valais, Switzerland. Book tastings, cellar visits, vineyard tours, and more from local winemakers.',
  },
};

interface PageProps {
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

export default async function ExperiencesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Parse search parameters
  const parsedParams: SearchParams = {
    search: params.q || undefined,
    type: parseTypeParam(params.type),
    commune: params.commune || undefined,
    minPrice: params.minPrice ? parseInt(params.minPrice, 10) : undefined,
    maxPrice: params.maxPrice ? parseInt(params.maxPrice, 10) : undefined,
    capacity: params.capacity ? parseInt(params.capacity, 10) : undefined,
    sort: parseSort(params.sort),
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
            Wine Experiences
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Discover unique wine experiences in Valais
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
