'use client';

import { ExperienceCard } from './ExperienceCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wine } from 'lucide-react';
import type { ExperienceSearchResult } from '@/server/queries/experience.queries';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
];

interface SearchResultsProps {
  experiences: ExperienceSearchResult[];
  sort: SortOption;
  onSortChange: (_sort: SortOption) => void;
}

export function SearchResults({
  experiences,
  sort,
  onSortChange,
}: SearchResultsProps) {
  const count = experiences.length;

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{count}</span>{' '}
          {count === 1 ? 'experience' : 'experiences'} found
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Sort by:</span>
          <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Grid or Empty State */}
      {count > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {experiences.map((experience) => (
            <ExperienceCard key={experience.id} experience={experience} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-cream-50 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-burgundy-100">
        <Wine className="h-8 w-8 text-burgundy-600" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">
        No experiences found
      </h3>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        No experiences match your filters. Try adjusting your search or clearing
        some filters to see more results.
      </p>
    </div>
  );
}
