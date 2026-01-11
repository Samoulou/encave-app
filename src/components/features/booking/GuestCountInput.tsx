'use client';

import { useTranslations } from 'next-intl';
import { Minus, Plus, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GuestCountInputProps {
  value: number;
  onChange: (_value: number) => void;
  min: number;
  max: number;
  isLoading?: boolean;
  remainingCapacity: number | null;
}

export function GuestCountInput({
  value,
  onChange,
  min,
  max,
  isLoading = false,
  remainingCapacity,
}: GuestCountInputProps) {
  const t = useTranslations('booking');

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const effectiveMax = remainingCapacity !== null ? Math.min(max, remainingCapacity) : max;
  const canDecrement = value > min;
  const canIncrement = value < effectiveMax;

  return (
    <div className="space-y-4">
      {/* Counter */}
      <div className="flex items-center justify-center gap-6">
        <Button
          variant="outline"
          size="icon"
          onClick={handleDecrement}
          disabled={!canDecrement || isLoading}
          className={cn(
            'h-12 w-12 rounded-full',
            !canDecrement && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Decrease guests"
        >
          <Minus className="h-5 w-5" />
        </Button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-burgundy-600" />
            <span className="text-4xl font-bold text-slate-900">{value}</span>
          </div>
          <span className="text-sm text-slate-500">
            {t('guests', { count: value })}
          </span>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={handleIncrement}
          disabled={!canIncrement || isLoading}
          className={cn(
            'h-12 w-12 rounded-full',
            !canIncrement && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Increase guests"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Capacity Info */}
      <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
        <span>{t('minGuests', { count: min })}</span>
        <span className="text-slate-300">|</span>
        {isLoading ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading...
          </span>
        ) : remainingCapacity !== null ? (
          <span
            className={cn(
              remainingCapacity <= 3 ? 'text-orange-600 font-medium' : ''
            )}
          >
            {t('remainingCapacity', { count: remainingCapacity })}
          </span>
        ) : (
          <span>{t('maxGuests', { count: max })}</span>
        )}
      </div>

      {/* Warning if low capacity */}
      {remainingCapacity !== null && remainingCapacity <= 3 && remainingCapacity > 0 && (
        <div className="flex justify-center">
          <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
            {t('remainingCapacity', { count: remainingCapacity })}
          </span>
        </div>
      )}
    </div>
  );
}
