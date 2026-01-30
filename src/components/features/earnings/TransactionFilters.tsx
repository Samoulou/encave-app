'use client';

import { useTransition } from 'react';
import { useQueryState } from 'nuqs';
import { X, Loader2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { format, subMonths } from 'date-fns';
import { fr, de, enUS } from 'date-fns/locale';

interface ExperienceOption {
  id: string;
  title: string;
}

interface TransactionFiltersProps {
  experiences: ExperienceOption[];
}

const localeMap = { fr, de, en: enUS };

// Generate last 12 months for dropdown
function getMonthOptions(locale: string) {
  const options = [];
  const now = new Date();
  const dateLocale = localeMap[locale as keyof typeof localeMap] || enUS;
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: dateLocale }),
    });
  }
  return options;
}

export function TransactionFilters({ experiences }: TransactionFiltersProps) {
  const t = useTranslations('earnings');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  // Use nuqs with startTransition for non-blocking URL updates
  const transitionOptions = { shallow: false, startTransition };

  const [monthFilter, setMonthFilter] = useQueryState('month', transitionOptions);
  const [experienceFilter, setExperienceFilter] = useQueryState('experience', transitionOptions);
  const [statusFilter, setStatusFilter] = useQueryState('status', transitionOptions);

  const monthOptions = getMonthOptions(locale);

  const STATUS_OPTIONS = [
    { value: 'paid', labelKey: 'filters.paid' },
    { value: 'pending', labelKey: 'filters.pending' },
    { value: 'refunded', labelKey: 'filters.refunded' },
  ];

  const hasFilters = monthFilter || experienceFilter || statusFilter;

  const clearFilters = () => {
    setMonthFilter(null);
    setExperienceFilter(null);
    setStatusFilter(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Month Filter */}
      <Select
        value={monthFilter ?? 'all'}
        onValueChange={(value) => setMonthFilter(value === 'all' ? null : value)}
      >
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder={t('filters.allMonths')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.allMonths')}</SelectItem>
          {monthOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Experience Filter */}
      {experiences.length > 0 && (
        <Select
          value={experienceFilter ?? 'all'}
          onValueChange={(value) =>
            setExperienceFilter(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder={t('filters.allExperiences')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allExperiences')}</SelectItem>
            {experiences.map((exp) => (
              <SelectItem key={exp.id} value={exp.id}>
                {exp.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Status Filter */}
      <Select
        value={statusFilter ?? 'all'}
        onValueChange={(value) => setStatusFilter(value === 'all' ? null : value)}
      >
        <SelectTrigger className="h-9 w-[120px]">
          <SelectValue placeholder={t('filters.allStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.allStatus')}</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Loading Indicator */}
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-burgundy-600" />
      )}

      {/* Clear All Filters */}
      {hasFilters && !isPending && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-1 text-slate-500 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
          {t('filters.clear')}
        </Button>
      )}
    </div>
  );
}
