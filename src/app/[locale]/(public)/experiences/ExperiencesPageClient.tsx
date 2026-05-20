'use client';

import * as React from 'react';
import { useCallback, useMemo, useTransition, useOptimistic } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ExperienceType } from '@prisma/client';
import { SearchBar } from '@/components/features/search/SearchBar';
import { SearchFilters } from '@/components/features/search/SearchFilters';
import { SearchResults } from '@/components/features/search/SearchResults';
import { ExperienceCard } from '@/components/features/experience/ExperienceCard';
import { DynamicMap } from '@/components/features/map/DynamicMap';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, X, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExperienceSearchResult } from '@/server/queries/experience.queries';
import type { MapWinery } from '@/components/features/map/types';

type SortOption =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'distance';

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface LocationSearchInfo {
  hasLocationSearch: boolean;
  locationName?: string;
}

interface ExperiencesPageClientProps {
  initialExperiences: ExperienceSearchResult[];
  communes: string[];
  pagination: PaginationInfo;
  locationSearch: LocationSearchInfo;
}

interface FilterState {
  search: string;
  types: ExperienceType[];
  commune: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  capacity: number | null;
  sort: SortOption;
}

export function ExperiencesPageClient({
  initialExperiences,
  communes,
  pagination,
  locationSearch,
}: ExperiencesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearchParams = useMemo(
    () => searchParams ?? new URLSearchParams(),
    [searchParams]
  );
  const [isPending, startTransition] = useTransition();

  // Parse current URL params (server-confirmed state)
  const serverParams: FilterState = {
    search: currentSearchParams.get('q') || '',
    types: parseTypes(currentSearchParams.get('type')),
    commune: currentSearchParams.get('commune'),
    minPrice: parseNumber(currentSearchParams.get('minPrice')),
    maxPrice: parseNumber(currentSearchParams.get('maxPrice')),
    capacity: parseNumber(currentSearchParams.get('capacity')),
    sort: (currentSearchParams.get('sort') as SortOption) || 'relevance',
  };

  // Optimistic state for instant UI updates
  const [optimisticFilters, setOptimisticFilters] = useOptimistic(serverParams);

  // Use optimistic values for display
  const currentParams = optimisticFilters;

  // Mobile filter state
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Update URL with new params - optimistic updates happen immediately
  const updateParams = useCallback(
    (
      updates: Record<string, string | string[] | null>,
      optimisticUpdate?: Partial<FilterState>
    ) => {
      // Step 1: Update UI IMMEDIATELY (optimistic)
      if (optimisticUpdate) {
        setOptimisticFilters((prev) => ({ ...prev, ...optimisticUpdate }));
      }

      // Step 2: Sync with server in background (non-blocking)
      startTransition(() => {
        const params = new URLSearchParams(currentSearchParams.toString());

        Object.entries(updates).forEach(([key, value]) => {
          if (
            value === null ||
            value === '' ||
            (Array.isArray(value) && value.length === 0)
          ) {
            params.delete(key);
          } else if (Array.isArray(value)) {
            params.set(key, value.join(','));
          } else {
            params.set(key, value);
          }
        });

        router.push(`/experiences?${params.toString()}`, { scroll: false });
      });
    },
    [router, currentSearchParams, setOptimisticFilters]
  );

  // Handler functions - reset page on filter changes
  // Each handler updates UI optimistically before syncing with server
  const handleSearchChange = (value: string) => {
    updateParams({ q: value || null, page: null }, { search: value });
  };

  const handleTypesChange = (types: ExperienceType[]) => {
    updateParams(
      { type: types.length > 0 ? types : null, page: null },
      { types }
    );
  };

  const handleCommuneChange = (commune: string | null) => {
    updateParams({ commune, page: null }, { commune });
  };

  const handleMinPriceChange = (price: number | null) => {
    updateParams(
      { minPrice: price !== null ? String(price) : null, page: null },
      { minPrice: price }
    );
  };

  const handleMaxPriceChange = (price: number | null) => {
    updateParams(
      { maxPrice: price !== null ? String(price) : null, page: null },
      { maxPrice: price }
    );
  };

  const handleCapacityChange = (capacity: number | null) => {
    updateParams(
      { capacity: capacity !== null ? String(capacity) : null, page: null },
      { capacity }
    );
  };

  const handleSortChange = (sort: SortOption) => {
    updateParams(
      { sort: sort !== 'relevance' ? sort : null, page: null },
      { sort }
    );
  };

  const handlePageChange = (page: number) => {
    updateParams({ page: page > 1 ? String(page) : null });
  };

  const handleClearFilters = () => {
    // Reset optimistic state to defaults
    setOptimisticFilters({
      search: '',
      types: [],
      commune: null,
      minPrice: null,
      maxPrice: null,
      capacity: null,
      sort: 'relevance',
    });
    startTransition(() => {
      router.push('/experiences', { scroll: false });
    });
  };

  const hasActiveFilters =
    currentParams.search ||
    currentParams.types.length > 0 ||
    currentParams.commune ||
    currentParams.minPrice !== null ||
    currentParams.maxPrice !== null ||
    currentParams.capacity !== null;

  const sortLabels: Record<SortOption, string> = {
    relevance: 'Recommandés',
    price_asc: 'Prix ↑',
    price_desc: 'Prix ↓',
    newest: 'Plus récents',
    distance: 'Plus proche',
  };
  const visibleSortOptions = (
    Object.keys(sortLabels) as SortOption[]
  ).filter(
    (option) => option !== 'distance' || locationSearch.hasLocationSearch
  );
  const mapWineries = buildMapWineries(initialExperiences);

  return (
    <>
      <div className="hidden lg:grid lg:grid-cols-[280px_minmax(0,1fr)_360px] lg:gap-6">
        <aside className="sticky top-24 h-[calc(100vh-7rem)] rounded-[18px] border border-stone-200 bg-white p-5 shadow-audit-card">
          <div className="mb-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-burgundy-700">
              Discovery
            </div>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink-900">
              Affiner
            </h2>
          </div>
          <SearchFilters
            types={currentParams.types}
            onTypesChange={handleTypesChange}
            commune={currentParams.commune}
            onCommuneChange={handleCommuneChange}
            communes={communes}
            minPrice={currentParams.minPrice}
            onMinPriceChange={handleMinPriceChange}
            maxPrice={currentParams.maxPrice}
            onMaxPriceChange={handleMaxPriceChange}
            capacity={currentParams.capacity}
            onCapacityChange={handleCapacityChange}
            onClearFilters={handleClearFilters}
          />
        </aside>

        <main className="min-w-0">
          <div className="mb-5 rounded-[18px] border border-stone-200 bg-white p-3 shadow-audit-card">
            <SearchBar
              value={currentParams.search}
              onChange={handleSearchChange}
              isPending={isPending}
              className="[&_input]:border-0 [&_input]:bg-cream-50 [&_input]:shadow-none"
            />
          </div>

          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-burgundy-700">
                Valais · {pagination.total} expériences
              </p>
              <h2 className="mt-1 font-display text-[30px] font-semibold text-ink-900">
                Expériences disponibles
              </h2>
            </div>
            <div className="flex gap-2">
              {visibleSortOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSortChange(option)}
                  className={cn(
                    'h-9 rounded-lg border px-3 text-xs font-semibold transition-colors',
                    currentParams.sort === option
                      ? 'border-burgundy-600 bg-burgundy-600 text-white'
                      : 'border-stone-200 bg-white text-ink-700 hover:border-burgundy-200'
                  )}
                >
                  {sortLabels[option]}
                </button>
              ))}
            </div>
          </div>

          <div
            className={cn(
              'space-y-4 transition-opacity duration-150',
              isPending && 'pointer-events-none opacity-70'
            )}
          >
            {initialExperiences.length > 0 ? (
              initialExperiences.map((experience, index) => (
                <ExperienceCard
                  key={experience.id}
                  experience={experience}
                  priority={index < 2}
                  className="[&>div]:grid [&>div]:grid-cols-[220px_1fr] [&>div]:rounded-[16px] [&_[class*='aspect']]:aspect-auto [&_[class*='aspect']]:h-full"
                />
              ))
            ) : (
              <div className="rounded-[18px] border border-dashed border-stone-300 bg-white p-10 text-center">
                <Search className="mx-auto h-8 w-8 text-burgundy-600" />
                <h3 className="mt-4 font-display text-xl font-semibold">
                  Aucun résultat trouvé
                </h3>
                <p className="mt-2 text-sm text-ink-500">
                  Essayez d’ajuster les filtres ou la recherche.
                </p>
              </div>
            )}
          </div>
        </main>

        <aside className="sticky top-24 h-[calc(100vh-7rem)] overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50 shadow-audit-card">
          <DynamicMap
            wineries={mapWineries}
            className="h-full w-full rounded-[18px]"
          />
          <div className="absolute left-4 top-4 rounded-xl bg-white/95 px-4 py-3 shadow-audit-card">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-burgundy-700">
              Domaines
            </div>
            <div className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
              <MapPin className="h-4 w-4 text-burgundy-700" />
              {mapWineries.length} lieux
            </div>
          </div>
        </aside>
      </div>

      <div className="lg:hidden">
        <MobileListing
          currentParams={currentParams}
          showMobileFilters={showMobileFilters}
          setShowMobileFilters={setShowMobileFilters}
          hasActiveFilters={!!hasActiveFilters}
          handleClearFilters={handleClearFilters}
          handleTypesChange={handleTypesChange}
          handleCommuneChange={handleCommuneChange}
          handleMinPriceChange={handleMinPriceChange}
          handleMaxPriceChange={handleMaxPriceChange}
          handleCapacityChange={handleCapacityChange}
          handleSearchChange={handleSearchChange}
          handleSortChange={handleSortChange}
          handlePageChange={handlePageChange}
          communes={communes}
          initialExperiences={initialExperiences}
          pagination={pagination}
          locationSearch={locationSearch}
          isPending={isPending}
        />
      </div>
    </>
  );
}

function MobileListing({
  currentParams,
  showMobileFilters,
  setShowMobileFilters,
  hasActiveFilters,
  handleClearFilters,
  handleTypesChange,
  handleCommuneChange,
  handleMinPriceChange,
  handleMaxPriceChange,
  handleCapacityChange,
  handleSearchChange,
  handleSortChange,
  handlePageChange,
  communes,
  initialExperiences,
  pagination,
  locationSearch,
  isPending,
}: {
  currentParams: FilterState;
  showMobileFilters: boolean;
  setShowMobileFilters: (_show: boolean) => void;
  hasActiveFilters: boolean;
  handleClearFilters: () => void;
  handleTypesChange: (_types: ExperienceType[]) => void;
  handleCommuneChange: (_commune: string | null) => void;
  handleMinPriceChange: (_price: number | null) => void;
  handleMaxPriceChange: (_price: number | null) => void;
  handleCapacityChange: (_capacity: number | null) => void;
  handleSearchChange: (_value: string) => void;
  handleSortChange: (_sort: SortOption) => void;
  handlePageChange: (_page: number) => void;
  communes: string[];
  initialExperiences: ExperienceSearchResult[];
  pagination: PaginationInfo;
  locationSearch: LocationSearchInfo;
  isPending: boolean;
}) {
  const t = useTranslations('search');

  return (
    <div>
      {/* Mobile Filter Toggle */}
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="flex-1"
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {t('filters')}
          {hasActiveFilters && (
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-burgundy-600 text-xs text-white">
              !
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-slate-600"
          >
            <X className="mr-1 h-4 w-4" />
            {t('clear')}
          </Button>
        )}
      </div>

      {/* Mobile Filters Panel */}
      <div
        className={cn(
          'mb-6 rounded-xl border border-stone-200 bg-white p-4 lg:hidden',
          showMobileFilters ? 'block' : 'hidden'
        )}
      >
        <SearchFilters
          types={currentParams.types}
          onTypesChange={handleTypesChange}
          commune={currentParams.commune}
          onCommuneChange={handleCommuneChange}
          communes={communes}
          minPrice={currentParams.minPrice}
          onMinPriceChange={handleMinPriceChange}
          maxPrice={currentParams.maxPrice}
          onMaxPriceChange={handleMaxPriceChange}
          capacity={currentParams.capacity}
          onCapacityChange={handleCapacityChange}
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* Desktop Sidebar Filters */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-xl border border-stone-200 bg-white p-6">
          <SearchFilters
            types={currentParams.types}
            onTypesChange={handleTypesChange}
            commune={currentParams.commune}
            onCommuneChange={handleCommuneChange}
            communes={communes}
            minPrice={currentParams.minPrice}
            onMinPriceChange={handleMinPriceChange}
            maxPrice={currentParams.maxPrice}
            onMaxPriceChange={handleMaxPriceChange}
            capacity={currentParams.capacity}
            onCapacityChange={handleCapacityChange}
            onClearFilters={handleClearFilters}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main>
        {/* Search Bar */}
        <SearchBar
          value={currentParams.search}
          onChange={handleSearchChange}
          isPending={isPending}
          className="mb-6"
        />

        {/* Loading Overlay - smooth transition for pending state */}
        <div
          className={cn(
            'relative transition-opacity duration-150',
            isPending && 'pointer-events-none opacity-70'
          )}
        >
          {isPending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-burgundy-200 border-t-burgundy-600" />
            </div>
          )}

          {/* Results */}
          <SearchResults
            experiences={initialExperiences}
            sort={currentParams.sort}
            onSortChange={handleSortChange}
            pagination={pagination}
            onPageChange={handlePageChange}
            locationSearch={locationSearch}
          />
        </div>
      </main>
    </div>
  );
}

function parseTypes(typeParam: string | null): ExperienceType[] {
  if (!typeParam) return [];
  const validTypes: ExperienceType[] = [
    'TASTING',
    'CELLAR_VISIT',
    'WORKSHOP',
    'VINEYARD_TOUR',
    'FOOD_PAIRING',
  ];
  return typeParam
    .split(',')
    .filter((t): t is ExperienceType =>
      validTypes.includes(t as ExperienceType)
    );
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

function buildMapWineries(experiences: ExperienceSearchResult[]): MapWinery[] {
  const bySlug = new Map<string, MapWinery>();

  experiences.forEach((experience) => {
    if (
      experience.winery.latitude == null ||
      experience.winery.longitude == null
    ) {
      return;
    }

    const existing = bySlug.get(experience.winery.slug);
    bySlug.set(experience.winery.slug, {
      id: experience.winery.id,
      name: experience.winery.name,
      slug: experience.winery.slug,
      commune: experience.winery.commune,
      coverPhoto: experience.coverPhoto,
      latitude: experience.winery.latitude,
      longitude: experience.winery.longitude,
      _count: { experiences: (existing?._count.experiences ?? 0) + 1 },
    });
  });

  return Array.from(bySlug.values());
}
