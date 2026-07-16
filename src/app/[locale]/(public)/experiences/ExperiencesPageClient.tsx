'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import {
  useQueryState,
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsFloat,
} from 'nuqs';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ExperienceType, Locale } from '@prisma/client';
import { SearchBar } from '@/components/features/search/SearchBar';
import { SearchFilters } from '@/components/features/search/SearchFilters';
import { SearchResults } from '@/components/features/search/SearchResults';
import { ActiveFilterPills } from '@/components/features/search/ActiveFilterPills';
import { ExperienceCard } from '@/components/features/experience/ExperienceCard';
import { DynamicMap } from '@/components/features/map/DynamicMap';
import { DesktopOnly } from '@/components/shared/DesktopOnly';
import { Button } from '@/components/ui/button';
import {
  SlidersHorizontal,
  X,
  MapPin,
  Search,
  List,
  Map as MapIcon,
} from 'lucide-react';
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

type CatalogueView = 'list' | 'map';

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
  /** Spoken-language filter (L-115), null = any language. */
  language: Locale | null;
}

/** Parse a `language` URL param into a valid Locale, else null. */
function parseLanguageParam(value: string | null | undefined): Locale | null {
  switch (value) {
    case Locale.FR:
    case Locale.DE:
    case Locale.EN:
      return value;
    default:
      return null;
  }
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
  // Explicit fetch state: React 18 useTransition stops tracking an async
  // callback at its first await — isFetching would drop before the
  // network answer and the grid would never dim (P-06 review).
  const [isFetching, setIsFetching] = React.useState(false);
  // A failed search (rate limit, network, server) must be visible: the
  // grid keeps the PREVIOUS dataset while the URL claims new filters.
  const [fetchFailed, setFetchFailed] = React.useState(false);

  const [urlState, setUrlState] = useQueryStates(
    {
      q: parseAsString,
      type: parseAsString,
      commune: parseAsString,
      minPrice: parseAsInteger,
      maxPrice: parseAsInteger,
      capacity: parseAsInteger,
      language: parseAsString,
      sort: parseAsString,
      page: parseAsInteger,
      quand: parseAsString,
      quand_fin: parseAsString,
      location: parseAsString,
      lat: parseAsFloat,
      lng: parseAsFloat,
    },
    // 'replace': the debounced free-text commits would otherwise stack
    // one history entry per keystroke batch — Back must leave the page,
    // not unwind filter states (each of which re-fires the search).
    { history: 'replace' }
  );

  // L-116: the Liste/Carte view lives in its OWN query state, deliberately
  // OUTSIDE `useQueryStates` above — it must not enter `requestKey`, so
  // toggling the view is a pure client re-render over already-fetched data
  // (no refetch). 'list' is the default; absent param === list.
  const [viewParam, setViewParam] = useQueryState('view', parseAsString);
  const view: CatalogueView = viewParam === 'map' ? 'map' : 'list';
  const handleViewChange = (next: CatalogueView) => {
    void setViewParam(next === 'map' ? 'map' : null);
  };

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
      language: parseLanguageParam(urlState.language),
    };
  }, [urlState]);

  const isDefaultState =
    !currentParams.search &&
    currentParams.types.length === 0 &&
    currentParams.commune === null &&
    currentParams.minPrice === null &&
    currentParams.maxPrice === null &&
    currentParams.capacity === null &&
    currentParams.language === null &&
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
  // Displayed data derives from state: the DEFAULT view always reads the
  // (possibly re-rendered, fresher) server props directly — no copy of
  // props into state to go stale (P-06 review).
  const displayData = isDefaultState ? initialData : results;

  // One fetch per URL-state change: covers deep links on mount, every
  // filter interaction, and pagination. The URL is the request.
  const requestKey = JSON.stringify(urlState);
  useEffect(() => {
    if (isDefaultState) return;

    const input: ExperienceSearchInput = {
      search: currentParams.search || undefined,
      type: currentParams.types.length > 0 ? currentParams.types : undefined,
      commune: currentParams.commune ?? undefined,
      minPrice: currentParams.minPrice ?? undefined,
      maxPrice: currentParams.maxPrice ?? undefined,
      capacity: currentParams.capacity ?? undefined,
      language: currentParams.language ?? undefined,
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

    // Structural stale-response guard: each effect run cancels the
    // previous one — no key comparison, no A→B→A hole.
    let stale = false;
    setIsFetching(true);
    void (async () => {
      const result = await searchExperiencesAction(input);
      if (stale) return;
      setIsFetching(false);
      if (result.success) {
        setResults(result.data);
        setFetchFailed(false);
      } else {
        // Previous results stay visible; the notice tells the user the
        // filters were NOT applied. Next URL change retries.
        setFetchFailed(true);
      }
    })();
    return () => {
      stale = true;
      setIsFetching(false);
    };
    // isDefaultState/currentParams/hasLocationSearch all derive from
    // urlState, which requestKey serializes.
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

  const handleLanguageChange = (language: Locale | null) => {
    void setUrlState({ language, page: null });
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
      language: null,
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
    currentParams.language !== null ||
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
      option !== 'distance' || displayData.locationSearch.hasLocationSearch
  );
  const mapWineries = buildMapWineries(displayData.experiences);

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
            language={currentParams.language}
            onLanguageChange={handleLanguageChange}
            onClearFilters={handleClearFilters}
          />
        </aside>

        <main className="min-w-0">
          {view === 'list' && (
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
          )}

          <div className="mb-5 rounded-[18px] border border-stone-200 bg-white p-3 shadow-audit-card">
            <SearchBar
              value={currentParams.search}
              onChange={handleSearchChange}
              isPending={isFetching}
              className="[&_input]:border-0 [&_input]:bg-cream-50 [&_input]:shadow-none"
            />
          </div>

          {fetchFailed && !isFetching && <SearchErrorNotice />}

          <CatalogueActiveFilters
            currentParams={currentParams}
            handleTypesChange={handleTypesChange}
            handleCommuneChange={handleCommuneChange}
            handleMinPriceChange={handleMinPriceChange}
            handleMaxPriceChange={handleMaxPriceChange}
            handleCapacityChange={handleCapacityChange}
            handleDateChange={handleDateChange}
            handleLanguageChange={handleLanguageChange}
            handleSearchChange={handleSearchChange}
            handleClearFilters={handleClearFilters}
            className="mb-5"
          />

          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-burgundy-700">
                {tSearch('resultsCount', {
                  count: displayData.pagination.total,
                })}
              </p>
              <h2 className="mt-1 font-display text-[30px] font-semibold text-ink-900">
                Expériences disponibles
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ViewSwitch view={view} onViewChange={handleViewChange} />
              <div className="flex min-w-max gap-2">
                {visibleSortOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={currentParams.sort === option}
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
          </div>

          {view === 'list' ? (
            <div
              className={cn(
                'grid gap-6 transition-opacity duration-150 xl:grid-cols-2',
                isFetching && 'pointer-events-none opacity-70'
              )}
            >
              {displayData.experiences.length > 0 ? (
                displayData.experiences.map((experience, index) => (
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
          ) : (
            <CatalogueMapView
              experiences={displayData.experiences}
              mapWineries={mapWineries}
              onWineryClick={handleWineryClick}
              heightClassName="h-[600px]"
              isFetching={isFetching}
            />
          )}
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
          handleLanguageChange={handleLanguageChange}
          handleSearchChange={handleSearchChange}
          handleSortChange={handleSortChange}
          handlePageChange={handlePageChange}
          communes={communes}
          experiences={displayData.experiences}
          pagination={displayData.pagination}
          locationSearch={displayData.locationSearch}
          mapWineries={mapWineries}
          handleWineryClick={handleWineryClick}
          view={view}
          onViewChange={handleViewChange}
          isFetching={isFetching}
          fetchFailed={fetchFailed}
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
  handleLanguageChange,
  handleSearchChange,
  handleSortChange,
  handlePageChange,
  communes,
  experiences,
  pagination,
  locationSearch,
  mapWineries,
  handleWineryClick,
  view,
  onViewChange,
  isFetching,
  fetchFailed,
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
  handleLanguageChange: (_language: Locale | null) => void;
  handleSearchChange: (_value: string) => void;
  handleSortChange: (_sort: SortOption) => void;
  handlePageChange: (_page: number) => void;
  communes: string[];
  experiences: ExperienceSearchResult[];
  pagination: PaginationInfo;
  locationSearch: LocationSearchInfo;
  mapWineries: MapWinery[];
  handleWineryClick: (_slug: string) => void;
  view: CatalogueView;
  onViewChange: (_view: CatalogueView) => void;
  isFetching: boolean;
  fetchFailed: boolean;
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
          language={currentParams.language}
          onLanguageChange={handleLanguageChange}
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* Main Content */}
      <main>
        {/* Search Bar */}
        <SearchBar
          value={currentParams.search}
          onChange={handleSearchChange}
          isPending={isFetching}
          className="mb-6"
        />

        {fetchFailed && !isFetching && <SearchErrorNotice />}

        <CatalogueActiveFilters
          currentParams={currentParams}
          handleTypesChange={handleTypesChange}
          handleCommuneChange={handleCommuneChange}
          handleMinPriceChange={handleMinPriceChange}
          handleMaxPriceChange={handleMaxPriceChange}
          handleCapacityChange={handleCapacityChange}
          handleDateChange={handleDateChange}
          handleLanguageChange={handleLanguageChange}
          handleSearchChange={handleSearchChange}
          handleClearFilters={handleClearFilters}
          className="mb-4"
        />

        {/* Liste / Carte toggle (L-116) */}
        <div className="mb-4 flex justify-end">
          <ViewSwitch view={view} onViewChange={onViewChange} />
        </div>

        {view === 'map' ? (
          <CatalogueMapView
            experiences={experiences}
            mapWineries={mapWineries}
            onWineryClick={handleWineryClick}
            heightClassName="h-[70vh]"
            isFetching={isFetching}
          />
        ) : (
          /* Loading Overlay - smooth transition for pending state */
          <div
            className={cn(
              'relative transition-opacity duration-150',
              isFetching && 'pointer-events-none opacity-70'
            )}
          >
            {isFetching && (
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
        )}
      </main>
    </div>
  );
}

function SearchErrorNotice() {
  const tErrors = useTranslations('errors');
  return (
    <div
      role="alert"
      className="mb-5 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {tErrors('genericError')}
    </div>
  );
}

/** L-116: segmented Liste / Carte switch (pure client view, no refetch). */
function ViewSwitch({
  view,
  onViewChange,
}: {
  view: CatalogueView;
  onViewChange: (_view: CatalogueView) => void;
}) {
  const t = useTranslations('search');
  const options: { value: CatalogueView; label: string; Icon: typeof List }[] =
    [
      { value: 'list', label: t('viewList'), Icon: List },
      { value: 'map', label: t('viewMap'), Icon: MapIcon },
    ];

  return (
    <div className="inline-flex items-center rounded-lg border border-stone-200 bg-white p-1">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onViewChange(value)}
          aria-pressed={view === value}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
            view === value
              ? 'bg-burgundy-600 text-white'
              : 'text-ink-700 hover:text-burgundy-700'
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * L-116: map view — full-width interactive map + a horizontal snap
 * carousel of the current page's cards. Renders over already-fetched
 * `displayData` (no extra request). mapbox-gl only downloads once the
 * user opens this view (DynamicMap is ssr:false + dynamically imported).
 */
function CatalogueMapView({
  experiences,
  mapWineries,
  onWineryClick,
  heightClassName,
  isFetching,
}: {
  experiences: ExperienceSearchResult[];
  mapWineries: MapWinery[];
  onWineryClick: (_slug: string) => void;
  heightClassName: string;
  isFetching: boolean;
}) {
  const t = useTranslations('search');

  return (
    <div
      className={cn(
        'space-y-4 transition-opacity duration-150',
        isFetching && 'pointer-events-none opacity-70'
      )}
    >
      <div
        className={cn(
          'overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50 shadow-audit-card',
          heightClassName
        )}
      >
        <DynamicMap
          wineries={mapWineries}
          onWineryClick={onWineryClick}
          className="h-full w-full rounded-[18px]"
        />
      </div>

      {experiences.length > 0 ? (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {experiences.map((experience, index) => (
            <div
              key={experience.id}
              className="w-[280px] shrink-0 snap-start sm:w-[320px]"
            >
              <ExperienceCard experience={experience} priority={index < 2} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-stone-300 bg-white p-10 text-center">
          <Search className="mx-auto h-8 w-8 text-burgundy-600" />
          <h3 className="mt-4 font-display text-xl font-semibold">
            {t('noResultsFound')}
          </h3>
          <p className="mt-2 text-sm text-ink-500">
            {t('tryDifferentFilters')}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * L-115: wires the shared filter state to the ActiveFilterPills badges —
 * used identically in the desktop and mobile layouts.
 */
function CatalogueActiveFilters({
  currentParams,
  handleTypesChange,
  handleCommuneChange,
  handleMinPriceChange,
  handleMaxPriceChange,
  handleCapacityChange,
  handleDateChange,
  handleLanguageChange,
  handleSearchChange,
  handleClearFilters,
  className,
}: {
  currentParams: FilterState;
  handleTypesChange: (_types: ExperienceType[]) => void;
  handleCommuneChange: (_commune: string | null) => void;
  handleMinPriceChange: (_price: number | null) => void;
  handleMaxPriceChange: (_price: number | null) => void;
  handleCapacityChange: (_capacity: number | null) => void;
  handleDateChange: (_quand: string | null) => void;
  handleLanguageChange: (_language: Locale | null) => void;
  handleSearchChange: (_value: string) => void;
  handleClearFilters: () => void;
  className?: string;
}) {
  return (
    <ActiveFilterPills
      search={currentParams.search}
      types={currentParams.types}
      commune={currentParams.commune}
      minPrice={currentParams.minPrice}
      maxPrice={currentParams.maxPrice}
      capacity={currentParams.capacity}
      quand={currentParams.quand}
      quandFin={currentParams.quandFin}
      language={currentParams.language}
      onRemoveSearch={() => handleSearchChange('')}
      onRemoveType={(type) =>
        handleTypesChange(currentParams.types.filter((v) => v !== type))
      }
      onRemoveCommune={() => handleCommuneChange(null)}
      onRemoveBudget={() => {
        handleMinPriceChange(null);
        handleMaxPriceChange(null);
      }}
      onRemoveDate={() => handleDateChange(null)}
      onRemoveCapacity={() => handleCapacityChange(null)}
      onRemoveLanguage={() => handleLanguageChange(null)}
      onClearAll={handleClearFilters}
      className={className}
    />
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
