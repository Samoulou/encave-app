'use client';

import { useState } from 'react';
import { ExperienceType } from '@prisma/client';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { X, SlidersHorizontal, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXPERIENCE_TYPE_OPTIONS } from '@/lib/validators/experience';
import { localDateFromKey, localDateKey } from '@/lib/utils/date-key';
import { formatDateShort } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';

const TYPE_OPTIONS: ExperienceType[] = EXPERIENCE_TYPE_OPTIONS.map(
  (option) => option.value
);

interface SearchFiltersProps {
  types: ExperienceType[];
  onTypesChange: (_types: ExperienceType[]) => void;
  commune: string | null;
  onCommuneChange: (_commune: string | null) => void;
  communes: string[];
  minPrice: number | null;
  onMinPriceChange: (_price: number | null) => void;
  maxPrice: number | null;
  onMaxPriceChange: (_price: number | null) => void;
  capacity: number | null;
  onCapacityChange: (_capacity: number | null) => void;
  /** "YYYY-MM-DD" date filter (P-05 / L-110), null = any date. */
  quand: string | null;
  /** Optional inclusive range end (weekend chip). */
  quandFin: string | null;
  onDateChange: (_quand: string | null) => void;
  onClearFilters: () => void;
  className?: string;
}

export function SearchFilters({
  types,
  onTypesChange,
  commune,
  onCommuneChange,
  communes,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  capacity,
  onCapacityChange,
  quand,
  quandFin,
  onDateChange,
  onClearFilters,
  className,
}: SearchFiltersProps) {
  const t = useTranslations('search');
  const tExp = useTranslations('experience.types');
  const tWinery = useTranslations('winery');
  const locale = useLocale() as Locale;
  const [isDateOpen, setIsDateOpen] = useState(false);

  const hasActiveFilters =
    types.length > 0 ||
    commune !== null ||
    minPrice !== null ||
    maxPrice !== null ||
    capacity !== null ||
    quand !== null;

  const dateLabel =
    quand === null
      ? t('anyDate')
      : quandFin !== null && quandFin !== quand
        ? t('dateRange', {
            from: formatDateShort(localDateFromKey(quand), locale),
            to: formatDateShort(localDateFromKey(quandFin), locale),
          })
        : formatDateShort(localDateFromKey(quand), locale);

  const handleTypeToggle = (type: ExperienceType) => {
    if (types.includes(type)) {
      onTypesChange(types.filter((t) => t !== type));
    } else {
      onTypesChange([...types, type]);
    }
  };

  const handlePriceChange = (
    value: string,
    setter: (_price: number | null) => void
  ) => {
    if (value === '') {
      setter(null);
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 0) {
        // Convert to cents
        setter(numValue * 100);
      }
    }
  };

  const handleCapacityChange = (value: string) => {
    if (value === '') {
      onCapacityChange(null);
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 1) {
        onCapacityChange(numValue);
      }
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with clear button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          <span className="font-medium">{t('filters')}</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            {t('clear')}
          </Button>
        )}
      </div>

      {/* Experience Type */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">
          {t('experienceType')}
        </Label>
        <div className="space-y-2">
          {TYPE_OPTIONS.map((typeValue) => (
            <div key={typeValue} className="flex items-center gap-2">
              <Checkbox
                id={`type-${typeValue}`}
                checked={types.includes(typeValue)}
                onCheckedChange={() => handleTypeToggle(typeValue)}
              />
              <Label
                htmlFor={`type-${typeValue}`}
                className="cursor-pointer text-sm font-normal text-muted-foreground"
              >
                {tExp(typeValue)}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Commune */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">
          {t('location')}
        </Label>
        <Select
          value={commune ?? 'all'}
          onValueChange={(v) => onCommuneChange(v === 'all' ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={tWinery('allCommunes')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tWinery('allCommunes')}</SelectItem>
            {communes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date (P-05 / L-110) */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">
          {t('date')}
        </Label>
        <div className="flex items-center gap-2">
          <DropdownMenu open={isDateOpen} onOpenChange={setIsDateOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-10 flex-1 items-center gap-2 truncate rounded-md border border-input bg-white px-3 text-left text-sm transition-colors hover:bg-stone-50',
                  quand === null ? 'text-slate-500' : 'text-slate-900'
                )}
              >
                <CalendarDays
                  className="h-4 w-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <span className="truncate">{dateLabel}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={quand !== null ? localDateFromKey(quand) : undefined}
                onSelect={(date) => {
                  onDateChange(date ? localDateKey(date) : null);
                  setIsDateOpen(false);
                }}
                disabled={{ before: new Date() }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
          {quand !== null && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDateChange(null)}
              className="h-10 w-10 shrink-0 text-slate-500 hover:text-slate-900"
              aria-label={t('clearDate')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Price Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">
          {t('priceRange')}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder={t('min')}
            value={minPrice !== null ? minPrice / 100 : ''}
            onChange={(e) =>
              handlePriceChange(e.target.value, onMinPriceChange)
            }
            className="h-10"
            aria-label={t('minPrice')}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            min={0}
            placeholder={t('max')}
            value={maxPrice !== null ? maxPrice / 100 : ''}
            onChange={(e) =>
              handlePriceChange(e.target.value, onMaxPriceChange)
            }
            className="h-10"
            aria-label={t('maxPrice')}
          />
        </div>
      </div>

      {/* Capacity */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">
          {t('groupSize')}
        </Label>
        <Input
          type="number"
          min={1}
          placeholder={t('anySize')}
          value={capacity ?? ''}
          onChange={(e) => handleCapacityChange(e.target.value)}
          className="h-10"
          aria-label={t('minGroupSize')}
        />
      </div>
    </div>
  );
}
