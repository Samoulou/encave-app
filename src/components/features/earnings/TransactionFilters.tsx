'use client';

import { useQueryState } from 'nuqs';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { format, subMonths } from 'date-fns';

interface ExperienceOption {
  id: string;
  title: string;
}

interface TransactionFiltersProps {
  experiences: ExperienceOption[];
}

// Generate last 12 months for dropdown
function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    });
  }
  return options;
}

const STATUS_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'refunded', label: 'Refunded' },
];

export function TransactionFilters({ experiences }: TransactionFiltersProps) {
  const [monthFilter, setMonthFilter] = useQueryState('month', { shallow: false });
  const [experienceFilter, setExperienceFilter] = useQueryState('experience', {
    shallow: false,
  });
  const [statusFilter, setStatusFilter] = useQueryState('status', { shallow: false });

  const monthOptions = getMonthOptions();

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
          <SelectValue placeholder="All months" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All months</SelectItem>
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

      {/* Status Filter */}
      <Select
        value={statusFilter ?? 'all'}
        onValueChange={(value) => setStatusFilter(value === 'all' ? null : value)}
      >
        <SelectTrigger className="h-9 w-[120px]">
          <SelectValue placeholder="All status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All status</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear All Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-1 text-slate-500 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
