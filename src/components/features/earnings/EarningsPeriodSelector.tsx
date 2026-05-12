'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useOptimistic } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type EarningsPeriod =
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'all_time';

const PERIOD_KEYS: Record<EarningsPeriod, string> = {
  this_month: 'thisMonth',
  last_month: 'lastMonth',
  this_year: 'thisYear',
  all_time: 'allTime',
};

interface EarningsPeriodSelectorProps {
  defaultValue?: EarningsPeriod;
}

export function EarningsPeriodSelector({
  defaultValue = 'this_year',
}: EarningsPeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('earnings.period');

  const currentPeriod =
    (searchParams.get('period') as EarningsPeriod) || defaultValue;
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

  const periodOptions: EarningsPeriod[] = [
    'this_month',
    'last_month',
    'this_year',
    'all_time',
  ];

  return (
    <Select value={optimisticPeriod} onValueChange={handlePeriodChange}>
      <SelectTrigger
        className={cn(
          'h-10 w-40 border-border bg-white font-medium text-foreground shadow-sm',
          isPending && 'opacity-70'
        )}
      >
        <SelectValue placeholder={t('selectPeriod')} />
      </SelectTrigger>
      <SelectContent>
        {periodOptions.map((value) => (
          <SelectItem key={value} value={value}>
            {t(PERIOD_KEYS[value])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
