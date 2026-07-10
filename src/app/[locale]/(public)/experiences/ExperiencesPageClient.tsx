'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useTransition } from 'react';
import {
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsFloat,
} from 'nuqs';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ExperienceType } from '@prisma/client';
import { SearchBar } from '@/components/features/search/SearchBar';
import { SearchFilters } from '@/components/features/search/SearchFilters';
import { SearchResults } from '@/components/features/search/SearchResults';
import { ExperienceCard } from '@/components/features/experience/ExperienceCard';
import { DynamicMap } from '@/components/features/map/DynamicMap';
import { DesktopOnly } from '@/components/shared/DesktopOnly';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, X, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_CATALOG_SORT,
  parseCatalogSort,
  parseDateKeyParam,
  parseExperienceTypes,
  type CatalogSort,
} from '@/lib/utils/search-params';
import {
  searchExperiencesAction,
  type ExperienceSearchData,
} from '@/server/actions/experience-search';
import type { ExperienceSearchInput } from '@/lib/validators/experienceSearch';
import type { ExperienceSearchResult } from '@/server/queries/experience.queries';
import type { MapWinery } from '@/components/features/map/types';

type SortOption = CatalogSort;

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
  /** "YYYY-MM-DD" date filter (P-05 / L-110), null = any date. */
  quand: string | null;
  /** Optional inclusive range end (weekend chip), null = single date. */
  quandFin: string | null;
}

/**
 * P-06 (D2): the /experiences page is STATIC — it always serves the
 * default dataset from the CDN. This client is the single owner of
 * filtering: the URL stays the source of truth (nuqs, shallow — no
 * server navigation), and any non-default state fetches results through
 * `searchExperiencesAction` in a transition. Resetting to defaults
 * restores the server-rendered dataset without a network call.
 */
export function ExperiencesPageClient({
  initialExperiences,
  communes,
  pagination,
  locationSearch,
}: ExperiencesPageClientProps) {
  const router = useRouter();
  const tSearch = useTranslations('search');
  const [isPending, startTransition] = useTransition();

  const [urlState, setUrlState] = useQueryStates(
    {
      q: parseAsString,
      type: parseAsString,
      commune: parseAsString,
      minPrice: parseAsInteger,
      maxPrice: parseAsInteger,
      capacity: parseAsInteger,
      sort: parseAsString,
      page: parseAsInteger,
      quand: parseAsString,
      quand_fin: parseAsString,
      location: parseAsString,
      lat: parseAsFloat,
      lng: parseAsFloat,
    },
    { history: 'push' }
  );

  const hasLocationSearch = Boolean(
    urlState.location && urlState.lat !== null && urlState.lng !== null
  );

  // Canonical filter state derived from the URL.
  const currentParams: FilterState = useMemo(() => {
    const quand = parseDateKeyParam(urlState.quand ?? undefined) ?? null;
    const rawQuandFin =
      parseDateKeyParam(urlState.quand_fin ?? undefined) ?? null;
    return {
      search: urlState.q ?? '',
      types: parseExperienceTypes(urlState.type),
      commune: urlState.commune,
      minPrice: urlState.minPrice,
      maxPrice: urlState.maxPrice,
      capacity: urlState.capacity,
      sort: parseCatalogSort(urlState.sort),
      quand,
      quandFin:
        quand !== null && rawQuandFin !== null && rawQuandFin >= quand
          ? rawQuandFin
          : null,
    };
  }, [urlState]);

  const isDefaultState =
    !currentParams.search &&
    currentParams.types.length === 0 &&
    currentParams.commune === null &&
    currentParams.minPrice === null &&
    currentParams.maxPrice === null &&
    currentParams.capacity === null &&
    currentParams.sort === DEFAULT_CATALOG_SORT &&
    currentParams.quand === null &&
    (urlState.page ?? 1) <= 1 &&
    !hasLocationSearch;

  const initialData: ExperienceSearchData = useMemo(
    () => ({
      experiences: initialExperiences,
      pagination,
      locationSearch,
    }),
    [initialExperiences, pagination, locationSearch]
  );

  const [results, setResults] =
    React.useState<ExperienceSearchData>(initialData);

  // One fetch per URL-state change: covers deep links on mount, every
  // filter interaction, and pagination. The URL is the request.
  const requestKey = JSON.stringify(urlState);
  const lastRequestRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastRequestRef.current === requestKey) return;
    lastRequestRef.current = requestKey;

    if (isDefaultState) {
      setResults(initialData);
      return;
    }

    const input: ExperienceSearchInput = {
      search: currentParams.search || undefined,
      type: currentParams.types.length > 0 ? currentParams.types : undefined,
      commune: currentParams.commune ?? undefined,
      minPrice: currentParams.minPrice ?? undefined,
      maxPrice: currentParams.maxPrice ?? undefined,
      capacity: currentParams.capacity ?? undefined,
      sort:
        currentParams.sort === 'distance' && !hasLocationSearch
          ? DEFAULT_CATALOG_SORT
          : currentParams.sort,
      page: Math.max(urlState.page ?? 1, 1),
      availableFrom: currentParams.quand ?? undefined,
      availableTo: currentParams.quandFin ?? undefined,
      location: urlState.location ?? undefined,
      lat: urlState.lat ?? undefined,
      lng: urlState.lng ?? undefined,
    };

    startTransition(async () => {
      const result = await searchExperiencesAction(input);
      // Stale response guard: only apply the answer of the LAST request.
      if (lastRequestRef.current !== requestKey) return;
      if (result.success) {
        setResults(result.data);
      }
      // On failure the previous results stay visible — the URL still
      // reflects the intent and a later interaction retries.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  // Mobile filter state
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Handler functions — every filter change resets the page.
  const handleSearchChange = (value: string) => {
    void setUrlState({ q: value || null, page: null });
  };

  const handleTypesChange = (types: ExperienceType[]) => {
    void setUrlState({
      type: types.length > 0 ? types.join(',') : null,
      page: null,
    });
  };

  const handleCommuneChange = (commune: string | null) => {
    void setUrlState({ commune, page: null });
  };

  const handleMinPriceChange = (price: number | null) => {
    void setUrlState({ minPrice: price, page: null });
  };

  const handleMaxPriceChange = (price: number | null) => {
    void setUrlState({ maxPrice: price, page: null });
  };

  const handleCapacityChange = (capacity: number | null) => {
    void setUrlState({ capacity, page: null });
  };

  const handleSortChange = (sort: SortOption) => {
    void setUrlState({
      sort: sort !== DEFAULT_CATALOG_SORT ? sort : null,
      page: null,
    });
  };

  const handleDateChange = (quand: string | null) => {
    // Picking a single date replaces any weekend range (quand_fin).
    void setUrlState({ quand, quand_fin: null, page: null });
  };

  const handlePageChange = (page: number) => {
    void setUrlState({ page: page > 1 ? page : null });
  };

  const handleClearFilters = () => {
    void setUrlState({
      q: null,
      type: null,
      commune: null,
      minPrice: null,
      maxPrice: null,
      capacity: null,
      sort: null,
      page: null,
      quand: null,
      quand_fin: null,
      location: null,
      lat: null,
      lng: null,
    });
  };

  const handleWineryClick = useCallback(
    (slug: string) => {
      router.push(`/wineries/${slug}`);
    },
    [router]
  );

  const hasActiveFilters =
    currentParams.search ||
    currentParams.types.length > 0 ||
    currentParams.commune ||
    currentParams.minPrice !== null ||
    currentParams.maxPrice !== null ||
    currentParams.capacity !== null ||
    currentParams.quand !== null;

  const sortLabels: Record<SortOption, string> = {
    next_availability: tSearch('sort.nextAvailability'),
    relevance: tSearch('sort.relevance'),
    price_asc: tSearch('sort.priceLowToHigh'),
    price_desc: tSearch('sort.priceHighToLow'),
    newest: tSearch('sort.newestFirst'),
    distance: tSearch('sort.distance'),
  };
  const visibleSortOptions = (Object.keys(sortLabels) as SortOption[]).filter(
    (option) =>
      option !== 'distance' || results.locationSearch.hasLocationSearch
  );
  const mapWineries = buildMapWineries(results.experiences);

  return (
    <>
      <div className="hidden lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside className="sticky top-24 h-fit rounded-[18px] border border-stone-200 bg-white p-5 shadow-audit-card">
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
            quand={currentParams.quand}
            quandFin={currentParams.quandFin}
            onDateChange={handleDateChange}
            onClearFilters={handleClearFilters}
          />
        </aside>

        <main className="min-w-0">
          <div className="relative mb-6 h-[320px] overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50 shadow-audit-card">
            <DesktopOnly>
              <DynamicMap
                wineries={mapWineries}
                onWineryClick={handleWineryClick}
                className="h-full w-full rounded-[18px]"
              />
            </DesktopOnly>
            <div className="absolute left-4 top-4 rounded-xl bg-white/95 px-4 py-3 shadow-audit-card">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-burgundy-700">
                Domaines
              </div>
              <div className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
                <MapPin className="h-4 w-4 text-burgundy-700" />
                {mapWineries.length} lieux
              </div>
            </div>
          </div>

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
                Valais · {results.pagination.total} expériences
              </p>
              <h2 className="mt-1 font-display text-[30px] font-semibold text-ink-900">
                Expériences disponibles
              </h2>
            </div>
            <div className="flex min-w-max gap-2">
              {visibleSortOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSortChange(option)}
                  className={cn(
                    'h-9 shrink-0 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition-colors',
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
              'grid gap-6 transition-opacity duration-150 xl:grid-cols-2',
              isPending && 'pointer-events-none opacity-70'
            )}
          >
            {results.experiences.length > 0 ? (
              results.experiences.map((experience, index) => (
                <ExperienceCard
                  key={experience.id}
                  experience={experience}
                  priority={index < 2}
                />
              ))
            ) : (
              <div className="rounded-[18px] border border-dashed border-stone-300 bg-white p-10 text-center xl:col-span-2">
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
          handleDateChange={handleDateChange}
          handleSearchChange={handleSearchChange}
          handleSortChange={handleSortChange}
          handlePageChange={handlePageChange}
          communes={communes}
          experiences={results.experiences}
          pagination={results.pagination}
          locationSearch={results.locationSearch}
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
  handleDateChange,
  handleSearchChange,
  handleSortChange,
  handlePageChange,
  communes,
  experiences,
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
  handleDateChange: (_quand: string | null) => void;
  handleSearchChange: (_value: string) => void;
  handleSortChange: (_sort: SortOption) => void;
  handlePageChange: (_page: number) => void;
  communes: string[];
  experiences: ExperienceSearchResult[];
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
          quand={currentParams.quand}
          quandFin={currentParams.quandFin}
          onDateChange={handleDateChange}
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
            quand={currentParams.quand}
            quandFin={currentParams.quandFin}
            onDateChange={handleDateChange}
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
            experiences={experiences}
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
