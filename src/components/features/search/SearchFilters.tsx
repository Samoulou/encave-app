'use client';

import { ExperienceType } from '@prisma/client';
import { useTranslations } from 'next-intl';
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
import { Button } from '@/components/ui/button';
import { X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS: ExperienceType[] = [
  'TASTING',
  'CELLAR_VISIT',
  'WORKSHOP',
  'VINEYARD_TOUR',
  'FOOD_PAIRING',
];

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
  onClearFilters,
  className,
}: SearchFiltersProps) {
  const t = useTranslations('search');
  const tExp = useTranslations('experience.types');
  const tWinery = useTranslations('winery');

  const hasActiveFilters =
    types.length > 0 ||
    commune !== null ||
    minPrice !== null ||
    maxPrice !== null ||
    capacity !== null;

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
        <div className="flex items-center gap-2 text-slate-900">
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          <span className="font-medium">{t('filters')}</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <X className="mr-1 h-4 w-4" />
            {t('clear')}
          </Button>
        )}
      </div>

      {/* Experience Type */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">
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
                className="cursor-pointer text-sm font-normal text-slate-600"
              >
                {tExp(typeValue)}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Commune */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">
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

      {/* Price Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">
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
          <span className="text-slate-400">-</span>
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
        <Label className="text-sm font-medium text-slate-700">
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
