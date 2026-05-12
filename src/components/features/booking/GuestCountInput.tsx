'use client';

import { useCallback, useRef } from 'react';
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
  const tCommon = useTranslations('common');

  // BUG-002 FIX: Use refs to track the latest values for stable callbacks
  const valueRef = useRef(value);
  valueRef.current = value;

  const minRef = useRef(min);
  minRef.current = min;

  const maxRef = useRef(max);
  maxRef.current = max;

  const remainingCapacityRef = useRef(remainingCapacity);
  remainingCapacityRef.current = remainingCapacity;

  // BUG-002 FIX: Use stable callbacks that read from refs
  const handleDecrement = useCallback(() => {
    const currentValue = valueRef.current;
    const currentMin = minRef.current;
    if (currentValue > currentMin) {
      onChange(currentValue - 1);
    }
  }, [onChange]);

  const handleIncrement = useCallback(() => {
    const currentValue = valueRef.current;
    const currentMax = maxRef.current;
    const currentRemaining = remainingCapacityRef.current;
    const effectiveMax =
      currentRemaining !== null
        ? Math.min(currentMax, currentRemaining)
        : currentMax;
    if (currentValue < effectiveMax) {
      onChange(currentValue + 1);
    }
  }, [onChange]);

  const effectiveMax =
    remainingCapacity !== null ? Math.min(max, remainingCapacity) : max;
  const canDecrement = value > min && !isLoading;
  const canIncrement = value < effectiveMax && !isLoading;

  return (
    <div className="space-y-4">
      {/* Counter */}
      <div className="flex items-center justify-center gap-6">
        <Button
          variant="outline"
          size="icon"
          onClick={handleDecrement}
          disabled={!canDecrement}
          className={cn(
            'h-12 w-12 rounded-full transition-all duration-150',
            canDecrement &&
              'hover:border-burgundy-300 hover:bg-burgundy-50 active:scale-95 active:bg-burgundy-100',
            !canDecrement && 'cursor-not-allowed opacity-50'
          )}
          aria-label={t('decreaseGuests')}
        >
          <Minus className="h-5 w-5" />
        </Button>

        <div className="flex min-w-[80px] flex-col items-center">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-burgundy-600" />
            <span
              className="text-2xl font-bold tabular-nums text-foreground"
              data-testid="guest-count-display"
            >
              {value}
            </span>
          </div>
          <span className="text-sm text-slate-500">
            {t('guests', { count: value })}
          </span>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={handleIncrement}
          disabled={!canIncrement}
          className={cn(
            'h-12 w-12 rounded-full transition-all duration-150',
            canIncrement &&
              'hover:border-burgundy-300 hover:bg-burgundy-50 active:scale-95 active:bg-burgundy-100',
            !canIncrement && 'cursor-not-allowed opacity-50'
          )}
          aria-label={t('increaseGuests')}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Capacity Info - BUG-031 FIX: Show text OR badge, not both */}
      <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
        <span>{t('minGuests', { count: min })}</span>
        <span className="text-slate-300">|</span>
        {isLoading ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {tCommon('loading')}
          </span>
        ) : remainingCapacity !== null && remainingCapacity > 3 ? (
          // Normal capacity (>3) - show as text
          <span>{t('remainingCapacity', { count: remainingCapacity })}</span>
        ) : remainingCapacity === null ? (
          <span>{t('maxGuests', { count: max })}</span>
        ) : null}
      </div>

      {/* Badge for low capacity - ONLY display when <= 3 */}
      {remainingCapacity !== null &&
        remainingCapacity <= 3 &&
        remainingCapacity > 0 && (
          <div className="flex justify-center">
            <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
              {t('remainingCapacity', { count: remainingCapacity })}
            </span>
          </div>
        )}
    </div>
  );
}
