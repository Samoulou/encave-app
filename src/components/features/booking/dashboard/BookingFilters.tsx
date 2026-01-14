'use client';

import { useTransition } from 'react';
import { useQueryState, parseAsArrayOf, parseAsString } from 'nuqs';
import { BookingStatus } from '@prisma/client';
import { Filter, X, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
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
  { value: BookingStatus.PENDING_PAYMENT, label: 'Pending Payment' },
];

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

  const hasFilters =
    (statusFilter && statusFilter.length > 0) ||
    experienceFilter ||
    dateFrom ||
    dateTo;

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
    <div className="flex flex-wrap items-center gap-2">
      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Filter className="h-4 w-4" />
            )}
            Status
            {statusFilter && statusFilter.length > 0 && (
              <span className="ml-1 rounded-full bg-burgundy-100 px-2 py-0.5 text-xs text-burgundy-700">
                {statusFilter.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={statusFilter?.includes(option.value) ?? false}
              onCheckedChange={() => toggleStatus(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {statusFilter && statusFilter.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setStatusFilter(null)}
              >
                Clear status filter
              </Button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Experience Filter */}
      {experiences.length > 0 && (
        <Select
          value={experienceFilter ?? 'all'}
          onValueChange={(value) =>
            setExperienceFilter(value === 'all' ? null : value)
          }
        >
          <SelectTrigger className="h-9 w-[180px]">
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
      )}

      {/* Date From Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {dateFrom ? format(parseISO(dateFrom), 'MMM d, yyyy') : 'From date'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={dateFrom ? parseISO(dateFrom) : undefined}
            onSelect={(date) =>
              setDateFrom(date ? format(date, 'yyyy-MM-dd') : null)
            }
          />
          {dateFrom && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setDateFrom(null)}
              >
                Clear
              </Button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Date To Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {dateTo ? format(parseISO(dateTo), 'MMM d, yyyy') : 'To date'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={dateTo ? parseISO(dateTo) : undefined}
            onSelect={(date) =>
              setDateTo(date ? format(date, 'yyyy-MM-dd') : null)
            }
          />
          {dateTo && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setDateTo(null)}
              >
                Clear
              </Button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear All Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-1 text-slate-500 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
          Clear all
        </Button>
      )}
    </div>
  );
}
