'use client';

import { useTransition } from 'react';
import { useQueryState, parseAsArrayOf, parseAsString } from 'nuqs';
import { BookingStatus } from '@prisma/client';
import { Filter, Loader2 } from 'lucide-react';
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

interface ExperienceOption {
  id: string;
  title: string;
}

interface BookingFiltersProps {
  experiences: ExperienceOption[];
}

const STATUS_OPTIONS = [
  { value: BookingStatus.CONFIRMED, label: 'Confirmed' },
  { value: BookingStatus.COMPLETED, label: 'Completed' },
  { value: BookingStatus.CANCELLED_BY_CLIENT, label: 'Cancelled by Client' },
  { value: BookingStatus.CANCELLED_BY_WINERY, label: 'Cancelled by Winery' },
  { value: BookingStatus.NO_SHOW, label: 'No-Show' },
  { value: BookingStatus.PENDING_PAYMENT, label: 'Pending' },
];

/**
 * Filter controls for bookings dashboard.
 * Simplified design matching US-UI-09 mockup.
 */
export function BookingFilters({ experiences }: BookingFiltersProps) {
  const [isPending, startTransition] = useTransition();

  // Use nuqs with startTransition for non-blocking URL updates
  const transitionOptions = { shallow: false, startTransition };

  const [statusFilter, setStatusFilter] = useQueryState(
    'status',
    parseAsArrayOf(parseAsString).withOptions(transitionOptions)
  );
  const [experienceFilter, setExperienceFilter] = useQueryState('experience', transitionOptions);
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
        <button
          className="flex items-center gap-2 h-10 px-4 rounded-lg border border-transparent hover:bg-[#f8f6f6] text-[#915564] text-sm font-bold transition-colors"
        >
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Filter className="h-5 w-5" />
          )}
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-1 flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-white text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {/* Status Filters */}
        <DropdownMenuLabel className="text-[#915564] text-xs uppercase tracking-wider">
          Status
        </DropdownMenuLabel>
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={statusFilter?.includes(option.value) ?? false}
            onCheckedChange={() => toggleStatus(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}

        {/* Experience Filter */}
        {experiences.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[#915564] text-xs uppercase tracking-wider">
              Experience
            </DropdownMenuLabel>
            <div className="px-2 py-1">
              <Select
                value={experienceFilter ?? 'all'}
                onValueChange={(value) =>
                  setExperienceFilter(value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All experiences" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All experiences</SelectItem>
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
        <DropdownMenuLabel className="text-[#915564] text-xs uppercase tracking-wider">
          Date Range
        </DropdownMenuLabel>
        <div className="px-2 py-1 flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex-1 h-9 px-3 text-sm rounded-lg border border-[#e5d2d7] bg-white hover:bg-[#f8f6f6] text-left truncate">
                {dateFrom ? format(parseISO(dateFrom), 'MMM d') : 'From'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateFrom ? parseISO(dateFrom) : undefined}
                onSelect={(date) =>
                  setDateFrom(date ? format(date, 'yyyy-MM-dd') : null)
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex-1 h-9 px-3 text-sm rounded-lg border border-[#e5d2d7] bg-white hover:bg-[#f8f6f6] text-left truncate">
                {dateTo ? format(parseISO(dateTo), 'MMM d') : 'To'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
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
              className="w-full px-2 py-2 text-sm text-[#915564] hover:text-primary hover:bg-[#f8f6f6] text-left transition-colors"
            >
              Clear all filters
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
