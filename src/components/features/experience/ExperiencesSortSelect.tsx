'use client';

import { useQueryState } from 'nuqs';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown } from 'lucide-react';

type SortValue = 'newest' | 'oldest' | 'alphabetical' | 'status';

const SORT_OPTIONS: { value: SortValue; labelKey: string }[] = [
  { value: 'newest', labelKey: 'newestFirst' },
  { value: 'oldest', labelKey: 'oldestFirst' },
  { value: 'alphabetical', labelKey: 'alphabetical' },
  { value: 'status', labelKey: 'byStatus' },
];

interface ExperiencesSortSelectProps {
  currentSort: string;
}

export function ExperiencesSortSelect({
  currentSort,
}: ExperiencesSortSelectProps) {
  const t = useTranslations('experience.sort');
  const [sort, setSort] = useQueryState('sort', {
    defaultValue: 'newest',
    shallow: false, // Trigger server-side re-fetch
  });

  return (
    <Select value={sort || currentSort} onValueChange={setSort}>
      <SelectTrigger className="w-[180px]">
        <ArrowUpDown className="mr-2 h-4 w-4" />
        <SelectValue placeholder={t('sortBy')} />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
