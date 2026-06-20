'use client';

import { ExperienceCard } from '@/components/features/experience/ExperienceCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Wine, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ExperienceSearchResult } from '@/server/queries/experience.queries';

type SortOption =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'distance';

const SORT_OPTIONS: {
  value: SortOption;
  labelKey: string;
  locationOnly?: boolean;
}[] = [
  { value: 'distance', labelKey: 'sort.distance', locationOnly: true },
  { value: 'relevance', labelKey: 'sort.relevance' },
  { value: 'price_asc', labelKey: 'sort.priceLowToHigh' },
  { value: 'price_desc', labelKey: 'sort.priceHighToLow' },
  { value: 'newest', labelKey: 'sort.newestFirst' },
];

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

interface SearchResultsProps {
  experiences: ExperienceSearchResult[];
  sort: SortOption;
  onSortChange: (_sort: SortOption) => void;
  pagination: PaginationInfo;
  onPageChange: (_page: number) => void;
  locationSearch?: LocationSearchInfo;
}

export function SearchResults({
  experiences,
  sort,
  onSortChange,
  pagination,
  onPageChange,
  locationSearch,
}: SearchResultsProps) {
  const { total, page, totalPages } = pagination;
  const count = experiences.length;
  const t = useTranslations('search');

  // Filter sort options - show distance only when location search is active
  const availableSortOptions = SORT_OPTIONS.filter(
    (opt) => !opt.locationOnly || locationSearch?.hasLocationSearch
  );

  return (
    <div className="space-y-6">
      {/* Location Search Header */}
      {locationSearch?.hasLocationSearch && locationSearch.locationName && (
        <div className="flex items-center gap-2 rounded-lg bg-burgundy-50 px-4 py-3 text-burgundy-800">
          <MapPin className="h-5 w-5 text-burgundy-600" aria-hidden="true" />
          <span className="text-sm font-medium">
            {t('experiencesNear', { location: locationSearch.locationName })}
          </span>
        </div>
      )}

      {/* Results Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p
          className="text-sm text-muted-foreground"
          data-testid="results-count"
        >
          <span className="font-medium text-foreground">{total}</span>{' '}
          {total === 1 ? t('experienceFound') : t('experiencesFound')}
          {totalPages > 1 && (
            <span className="ml-1 text-muted-foreground">
              ({t('pageOf', { page, totalPages })})
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('sortBy')}:</span>
          <Select
            value={sort}
            onValueChange={(v) => onSortChange(v as SortOption)}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableSortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Grid or Empty State */}
      {count > 0 ? (
        <div
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="search-results-grid"
        >
          {experiences.map((experience) => (
            <ExperienceCard key={experience.id} experience={experience} />
          ))}
        </div>
      ) : (
        <EmptyState locationName={locationSearch?.locationName} />
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (_page: number) => void;
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  // Generate page numbers to show (max 5 visible)
  const getVisiblePages = () => {
    const pages: number[] = [];
    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);

    // Adjust start if we're near the end
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <nav
      className="flex items-center justify-center gap-1"
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {visiblePages[0] !== undefined && visiblePages[0] > 1 && (
        <>
          <Button
            variant={page === 1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(1)}
            className="min-w-[40px]"
          >
            1
          </Button>
          {visiblePages[0] > 2 && (
            <span className="px-2 text-muted-foreground">...</span>
          )}
        </>
      )}

      {visiblePages.map((p) => (
        <Button
          key={p}
          variant={page === p ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPageChange(p)}
          className="min-w-[40px]"
          aria-current={page === p ? 'page' : undefined}
        >
          {p}
        </Button>
      ))}

      {(() => {
        const lastVisible = visiblePages[visiblePages.length - 1];
        return (
          lastVisible !== undefined &&
          lastVisible < totalPages && (
            <>
              {lastVisible < totalPages - 1 && (
                <span className="px-2 text-muted-foreground">...</span>
              )}
              <Button
                variant={page === totalPages ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(totalPages)}
                className="min-w-[40px]"
              >
                {totalPages}
              </Button>
            </>
          )
        );
      })()}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

interface EmptyStateProps {
  locationName?: string;
}

function EmptyState({ locationName }: EmptyStateProps) {
  const t = useTranslations('search');

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-cream-50 px-6 py-16 text-center"
      data-testid="empty-state"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-burgundy-100">
        <Wine className="h-8 w-8 text-burgundy-600" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
        {t('noResultsFound')}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {locationName
          ? t('noExperiencesAtLocation', { location: locationName })
          : t('tryDifferentFilters')}
      </p>
    </div>
  );
}
