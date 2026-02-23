'use client';

import { useState, useTransition, useEffect, useOptimistic } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type FilterStatus = 'all' | 'published' | 'drafts' | 'archived';

interface ExperienceFiltersProps {
  publishedCount: number;
  draftsCount: number;
  archivedCount: number;
}

export function ExperienceFilters({
  publishedCount,
  draftsCount,
  archivedCount,
}: ExperienceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('experience.filters');

  const currentFilter = (searchParams.get('filter') as FilterStatus) || 'all';
  const currentSearch = searchParams.get('q') || '';

  const [optimisticFilter, setOptimisticFilter] = useOptimistic(currentFilter);
  const [searchValue, setSearchValue] = useState(currentSearch);

  // Sync search input when URL changes externally
  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filtering
    params.delete('page');
    return params.toString();
  };

  const handleFilterChange = (filter: FilterStatus) => {
    setOptimisticFilter(filter);
    startTransition(() => {
      router.push(`?${updateParams('filter', filter)}`, { scroll: false });
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  // Debounced search
  useEffect(() => {
    if (searchValue === currentSearch) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchValue) {
        params.set('q', searchValue);
      } else {
        params.delete('q');
      }
      params.delete('page');
      startTransition(() => {
        router.push(`?${params.toString()}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, currentSearch, router, searchParams]);

  const filters: { key: FilterStatus; labelKey: 'all' | 'published' | 'drafts' | 'archived'; count?: number }[] = [
    { key: 'all', labelKey: 'all' },
    { key: 'published', labelKey: 'published', count: publishedCount },
    { key: 'drafts', labelKey: 'drafts', count: draftsCount },
    { key: 'archived', labelKey: 'archived', count: archivedCount },
  ];

  return (
    <div
      className={cn(
        'flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-2 rounded-xl shadow-sm border border-[#e5dbdd]/50 transition-opacity',
        isPending && 'opacity-70'
      )}
    >
      {/* Search */}
      <div className="relative w-full lg:max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
        <Input
          type="text"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="pl-10 border-none bg-[#f8f6f6] focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 px-2 lg:px-0">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => handleFilterChange(filter.key)}
            className={cn(
              'whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              optimisticFilter === filter.key
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-[#f8f6f6] text-gray-600 hover:bg-gray-200'
            )}
          >
            {t(filter.labelKey)}
            {filter.count !== undefined && (
              <span className="ml-1 opacity-60">{filter.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
