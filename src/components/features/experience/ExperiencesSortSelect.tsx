'use client';

import { useQueryState } from 'nuqs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'status', label: 'By Status' },
] as const;

interface ExperiencesSortSelectProps {
  currentSort: string;
}

export function ExperiencesSortSelect({ currentSort }: ExperiencesSortSelectProps) {
  const [sort, setSort] = useQueryState('sort', {
    defaultValue: 'newest',
    shallow: false, // Trigger server-side re-fetch
  });

  return (
    <Select value={sort || currentSort} onValueChange={setSort}>
      <SelectTrigger className="w-[180px]">
        <ArrowUpDown className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
