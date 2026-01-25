'use client';

import * as React from 'react';
import { useCallback, useTransition, useOptimistic } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ExperienceType } from '@prisma/client';
import { SearchBar } from '@/components/features/search/SearchBar';
import { SearchFilters } from '@/components/features/search/SearchFilters';
import { SearchResults } from '@/components/features/search/SearchResults';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExperienceSearchResult } from '@/server/queries/experience.queries';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'distance';

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
  const t = useTranslations('search');
  const [isPending, startTransition] = useTransition();

  // Parse current URL params (server-confirmed state)
  const serverParams: FilterState = {
    search: searchParams.get('q') || '',
    types: parseTypes(searchParams.get('type')),
    commune: searchParams.get('commune'),
    minPrice: parseNumber(searchParams.get('minPrice')),
    maxPrice: parseNumber(searchParams.get('maxPrice')),
    capacity: parseNumber(searchParams.get('capacity')),
    sort: (searchParams.get('sort') as SortOption) || 'relevance',
  };

  // Optimistic state for instant UI updates
  const [optimisticFilters, setOptimisticFilters] = useOptimistic(serverParams);

  // Use optimistic values for display
  const currentParams = optimisticFilters;

  // Mobile filter state
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Update URL with new params - optimistic updates happen immediately
  const updateParams = useCallback(
    (updates: Record<string, string | string[] | null>, optimisticUpdate?: Partial<FilterState>) => {
      // Step 1: Update UI IMMEDIATELY (optimistic)
      if (optimisticUpdate) {
        setOptimisticFilters((prev) => ({ ...prev, ...optimisticUpdate }));
      }

      // Step 2: Sync with server in background (non-blocking)
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());

        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
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
    [router, searchParams, setOptimisticFilters]
  );

  // Handler functions - reset page on filter changes
  // Each handler updates UI optimistically before syncing with server
  const handleSearchChange = (value: string) => {
    updateParams({ q: value || null, page: null }, { search: value });
  };

  const handleTypesChange = (types: ExperienceType[]) => {
    updateParams({ type: types.length > 0 ? types : null, page: null }, { types });
  };

  const handleCommuneChange = (commune: string | null) => {
    updateParams({ commune, page: null }, { commune });
  };

  const handleMinPriceChange = (price: number | null) => {
    updateParams({ minPrice: price !== null ? String(price) : null, page: null }, { minPrice: price });
  };

  const handleMaxPriceChange = (price: number | null) => {
    updateParams({ maxPrice: price !== null ? String(price) : null, page: null }, { maxPrice: price });
  };

  const handleCapacityChange = (capacity: number | null) => {
    updateParams({ capacity: capacity !== null ? String(capacity) : null, page: null }, { capacity });
  };

  const handleSortChange = (sort: SortOption) => {
    updateParams({ sort: sort !== 'relevance' ? sort : null, page: null }, { sort });
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

  return (
    <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
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
        <div className={cn(
          'relative transition-opacity duration-150',
          isPending && 'opacity-70 pointer-events-none'
        )}>
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
    .filter((t): t is ExperienceType => validTypes.includes(t as ExperienceType));
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}
