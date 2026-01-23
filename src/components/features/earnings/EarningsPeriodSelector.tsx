'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useOptimistic } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type EarningsPeriod = 'this_month' | 'last_month' | 'this_year' | 'all_time';

const PERIOD_OPTIONS: { value: EarningsPeriod; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
];

interface EarningsPeriodSelectorProps {
  defaultValue?: EarningsPeriod;
}

export function EarningsPeriodSelector({
  defaultValue = 'this_year',
}: EarningsPeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentPeriod = (searchParams.get('period') as EarningsPeriod) || defaultValue;
  const [optimisticPeriod, setOptimisticPeriod] = useOptimistic(currentPeriod);

  const handlePeriodChange = (value: EarningsPeriod) => {
    setOptimisticPeriod(value);
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (value === defaultValue) {
        params.delete('period');
      } else {
        params.set('period', value);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <Select value={optimisticPeriod} onValueChange={handlePeriodChange}>
      <SelectTrigger
        className={`w-40 h-10 bg-white border-[#e5d2d7] text-[#1a0f12] font-medium shadow-sm ${
          isPending ? 'opacity-70' : ''
        }`}
      >
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
