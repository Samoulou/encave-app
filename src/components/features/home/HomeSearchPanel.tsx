'use client';

import { FormEvent, useState } from 'react';
import { CalendarDays, Minus, Plus, Search, Users, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { LocationAutocomplete } from '@/components/features/search/LocationAutocomplete';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/i18n/formatters';
import { localDateKey } from '@/lib/utils/date-key';
import { cn } from '@/lib/utils';
import type { ValaisLocation } from '@/lib/constants/locations';
import type { Locale } from '@/i18n/routing';

interface HomeSearchPanelProps {
  variant?: 'desktop' | 'mobile';
}

export function HomeSearchPanel({ variant = 'desktop' }: HomeSearchPanelProps) {
  const t = useTranslations('search.homePanel');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] =
    useState<ValaisLocation | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [capacity, setCapacity] = useState(2);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams();
    params.set('capacity', String(capacity));

    if (selectedDate) {
      params.set('quand', localDateKey(selectedDate));
    }

    if (selectedLocation) {
      params.set('location', selectedLocation.id);
      params.set('lat', selectedLocation.latitude.toString());
      params.set('lng', selectedLocation.longitude.toString());
      params.set('sort', 'distance');
    }

    router.push(`/experiences?${params.toString()}`);
  };

  const dateLabel = selectedDate
    ? formatDate(selectedDate, locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : t('anyDate');

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'relative z-50 bg-white shadow-[0_18px_50px_-12px_rgba(58,14,31,.25),0_0_0_1px_rgba(154,42,72,.08)]',
        variant === 'desktop'
          ? 'flex max-w-[720px] items-center rounded-[18px] p-1.5'
          : 'grid grid-cols-2 overflow-visible rounded-[18px]'
      )}
    >
      <div
        className={cn(
          variant === 'desktop'
            ? 'relative z-50 min-w-0 flex-[1.2] border-r border-stone-200 px-[18px] py-2'
            : 'col-span-2 border-b border-[#efe4e6] px-3.5 py-3'
        )}
      >
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
          {t('where')}
        </div>
        <LocationAutocomplete
          value={selectedLocation}
          onChange={setSelectedLocation}
          placeholder={t('allValais')}
          className="mt-1 [&_input]:h-9 [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-8 [&_input]:text-sm [&_input]:font-semibold [&_input]:text-ink-900 [&_input]:shadow-none [&_input]:placeholder:text-ink-900 [&_input]:focus-visible:ring-0"
        />
      </div>

      {/* "Quand" date field (P-05 / L-110) */}
      <div
        className={cn(
          variant === 'desktop'
            ? 'min-w-[150px] border-r border-stone-200 px-[18px] py-2'
            : 'col-span-2 border-b border-[#efe4e6] px-3.5 py-3'
        )}
      >
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
          {t('when')}
        </div>
        <div className="mt-1 flex h-9 items-center gap-2">
          <DropdownMenu open={isDateOpen} onOpenChange={setIsDateOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold text-ink-900"
              >
                <CalendarDays
                  className="h-4 w-4 shrink-0 text-ink-500"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{dateLabel}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side={variant === 'desktop' ? 'top' : 'bottom'}
              className="w-auto p-0"
            >
              <Calendar
                mode="single"
                selected={selectedDate ?? undefined}
                onSelect={(date) => {
                  setSelectedDate(date ?? null);
                  setIsDateOpen(false);
                }}
                disabled={{ before: new Date() }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-500 transition-colors hover:bg-cream-100 hover:text-ink-900"
              aria-label={t('clearDate')}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          variant === 'desktop'
            ? 'min-w-[168px] px-[18px] py-2'
            : 'col-span-2 border-b border-[#efe4e6] px-3.5 py-3'
        )}
      >
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
          {t('guests')}
        </div>
        <div className="mt-1 flex h-9 items-center gap-2">
          <Users className="h-4 w-4 text-ink-500" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">
            {t('personCount', { count: capacity })}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setCapacity((value) => Math.max(1, value - 1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 text-ink-700 transition-colors hover:border-burgundy-200 hover:bg-cream-100"
              aria-label={t('removePerson')}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setCapacity((value) => Math.min(20, value + 1))}
              className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 text-ink-700 transition-colors hover:border-burgundy-200 hover:bg-cream-100"
              aria-label={t('addPerson')}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        className={cn(
          'gap-2 bg-burgundy-600 text-sm font-semibold text-white transition-colors hover:bg-burgundy-700',
          variant === 'desktop'
            ? 'ml-1.5 h-[62px] rounded-[14px] px-7'
            : 'col-span-2 h-12 rounded-none rounded-b-[18px]'
        )}
      >
        <Search className="h-[15px] w-[15px]" aria-hidden="true" />
        {t('explore')}
      </Button>
    </form>
  );
}
