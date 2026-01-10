'use client';

import { ExperienceType } from '@prisma/client';
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

const TYPE_OPTIONS: { value: ExperienceType; label: string }[] = [
  { value: 'TASTING', label: 'Tasting' },
  { value: 'CELLAR_VISIT', label: 'Cellar Visit' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'VINEYARD_TOUR', label: 'Vineyard Tour' },
  { value: 'FOOD_PAIRING', label: 'Food Pairing' },
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
          <span className="font-medium">Filters</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <X className="mr-1 h-4 w-4" />
            Clear all
          </Button>
        )}
      </div>

      {/* Experience Type */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">
          Experience Type
        </Label>
        <div className="space-y-2">
          {TYPE_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox
                id={`type-${option.value}`}
                checked={types.includes(option.value)}
                onCheckedChange={() => handleTypeToggle(option.value)}
              />
              <Label
                htmlFor={`type-${option.value}`}
                className="cursor-pointer text-sm font-normal text-slate-600"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Commune */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">Location</Label>
        <Select
          value={commune ?? 'all'}
          onValueChange={(v) => onCommuneChange(v === 'all' ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All communes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All communes</SelectItem>
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
          Price Range (CHF)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={minPrice !== null ? minPrice / 100 : ''}
            onChange={(e) => handlePriceChange(e.target.value, onMinPriceChange)}
            className="h-10"
            aria-label="Minimum price"
          />
          <span className="text-slate-400">-</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={maxPrice !== null ? maxPrice / 100 : ''}
            onChange={(e) => handlePriceChange(e.target.value, onMaxPriceChange)}
            className="h-10"
            aria-label="Maximum price"
          />
        </div>
      </div>

      {/* Capacity */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700">
          Group Size (minimum)
        </Label>
        <Input
          type="number"
          min={1}
          placeholder="Any size"
          value={capacity ?? ''}
          onChange={(e) => handleCapacityChange(e.target.value)}
          className="h-10"
          aria-label="Minimum group size"
        />
      </div>
    </div>
  );
}
