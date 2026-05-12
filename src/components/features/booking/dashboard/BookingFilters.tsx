'use client';

import { useTransition } from 'react';
import { useQueryState, parseAsArrayOf, parseAsString } from 'nuqs';
import { BookingStatus } from '@prisma/client';
import { Filter, Loader2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';
import { fr, de, enUS } from 'date-fns/locale';

interface ExperienceOption {
  id: string;
  title: string;
}

interface BookingFiltersProps {
  experiences: ExperienceOption[];
}

const STATUS_OPTIONS = [
  { value: BookingStatus.CONFIRMED, labelKey: 'confirmed' },
  { value: BookingStatus.COMPLETED, labelKey: 'completed' },
  { value: BookingStatus.CANCELLED_BY_CLIENT, labelKey: 'cancelledByClient' },
  { value: BookingStatus.CANCELLED_BY_WINERY, labelKey: 'cancelledByWinery' },
  { value: BookingStatus.NO_SHOW, labelKey: 'noShow' },
  { value: BookingStatus.PENDING_PAYMENT, labelKey: 'pending' },
];

const localeMap = { fr, de, en: enUS };

/**
 * Filter controls for bookings dashboard.
 * Simplified design matching US-UI-09 mockup.
 */
export function BookingFilters({ experiences }: BookingFiltersProps) {
  const t = useTranslations('bookings');
  const tStatus = useTranslations('bookings.status');
  const locale = useLocale();
  const dateLocale = localeMap[locale as keyof typeof localeMap] || enUS;
  const [isPending, startTransition] = useTransition();

  // Use nuqs with startTransition for non-blocking URL updates
  const transitionOptions = { shallow: false, startTransition };

  const [statusFilter, setStatusFilter] = useQueryState(
    'status',
    parseAsArrayOf(parseAsString).withOptions(transitionOptions)
  );
  const [experienceFilter, setExperienceFilter] = useQueryState(
    'experience',
    transitionOptions
  );
  const [dateFrom, setDateFrom] = useQueryState('from', transitionOptions);
  const [dateTo, setDateTo] = useQueryState('to', transitionOptions);

  const activeFilterCount = [
    statusFilter && statusFilter.length > 0,
    experienceFilter,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter(null);
    setExperienceFilter(null);
    setDateFrom(null);
    setDateTo(null);
  };

  const toggleStatus = (status: string) => {
    const current = statusFilter || [];
    if (current.includes(status)) {
      const newFilter = current.filter((s) => s !== status);
      setStatusFilter(newFilter.length > 0 ? newFilter : null);
    } else {
      setStatusFilter([...current, status]);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-10 items-center gap-2 rounded-lg border border-transparent px-4 text-sm font-bold text-[#915564] transition-colors hover:bg-[#f8f6f6]">
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Filter className="h-5 w-5" />
          )}
          {t('filters.filter')}
          {activeFilterCount > 0 && (
            <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {/* Status Filters */}
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-[#915564]">
          {t('filters.status')}
        </DropdownMenuLabel>
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={statusFilter?.includes(option.value) ?? false}
            onCheckedChange={() => toggleStatus(option.value)}
          >
            {tStatus(option.labelKey)}
          </DropdownMenuCheckboxItem>
        ))}

        {/* Experience Filter */}
        {experiences.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-[#915564]">
              {t('filters.experience')}
            </DropdownMenuLabel>
            <div className="px-2 py-1">
              <Select
                value={experienceFilter ?? 'all'}
                onValueChange={(value) =>
                  setExperienceFilter(value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={t('filters.allExperiences')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('filters.allExperiences')}
                  </SelectItem>
                  {experiences.map((exp) => (
                    <SelectItem key={exp.id} value={exp.id}>
                      {exp.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Date Range */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-[#915564]">
          {t('filters.dateRange')}
        </DropdownMenuLabel>
        <div className="flex gap-2 px-2 py-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 flex-1 truncate rounded-lg border border-border bg-white px-3 text-left text-sm hover:bg-[#f8f6f6]">
                {dateFrom
                  ? format(parseISO(dateFrom), 'MMM d', { locale: dateLocale })
                  : t('filters.from')}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                locale={dateLocale}
                selected={dateFrom ? parseISO(dateFrom) : undefined}
                onSelect={(date) =>
                  setDateFrom(date ? format(date, 'yyyy-MM-dd') : null)
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 flex-1 truncate rounded-lg border border-border bg-white px-3 text-left text-sm hover:bg-[#f8f6f6]">
                {dateTo
                  ? format(parseISO(dateTo), 'MMM d', { locale: dateLocale })
                  : t('filters.to')}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                locale={dateLocale}
                selected={dateTo ? parseISO(dateTo) : undefined}
                onSelect={(date) =>
                  setDateTo(date ? format(date, 'yyyy-MM-dd') : null)
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <button
              onClick={clearFilters}
              className="w-full px-2 py-2 text-left text-sm text-[#915564] transition-colors hover:bg-[#f8f6f6] hover:text-primary"
            >
              {t('filters.clearAll')}
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
