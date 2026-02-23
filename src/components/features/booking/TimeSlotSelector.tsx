'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTimeSlotsForDate, type TimeSlotAvailability } from '@/server/actions/booking';

interface TimeSlotSelectorProps {
  experienceId: string;
  selectedDate: string | null;
  selectedTime: string | null;
  onTimeChange: (_time: string | null) => void;
  onCapacityUpdate: (_capacity: number | null) => void;
}

export function TimeSlotSelector({
  experienceId,
  selectedDate,
  selectedTime,
  onTimeChange,
  onCapacityUpdate,
}: TimeSlotSelectorProps) {
  const t = useTranslations('booking');
  const tCommon = useTranslations('common');
  const [slots, setSlots] = useState<TimeSlotAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeSlots = useCallback(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    getTimeSlotsForDate(experienceId, selectedDate)
      .then((result) => {
        if (result.success) {
          setSlots(result.data);
          // BUG-030 FIX: Handle previously selected time
          if (selectedTime) {
            const selectedSlot = result.data.find((s) => s.timeSlot === selectedTime);
            if (selectedSlot?.available) {
              // Time still available - update capacity for new date
              onCapacityUpdate(selectedSlot.remainingCapacity);
            } else {
              // Time no longer available - clear selection
              onTimeChange(null);
              onCapacityUpdate(null);
            }
          }
        } else {
          setError(result.error.message);
          setSlots([]);
        }
      })
      .catch(() => {
        setError('Failed to load time slots. Please try again.');
        setSlots([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [experienceId, selectedDate, selectedTime, onTimeChange, onCapacityUpdate]);

  useEffect(() => {
    fetchTimeSlots();
  }, [fetchTimeSlots]);

  const handleSlotSelect = (slot: TimeSlotAvailability) => {
    if (!slot.available) return;
    onTimeChange(slot.timeSlot);
    onCapacityUpdate(slot.remainingCapacity);
  };

  // Format time for display in 24-hour format (e.g., "10:00" -> "10:00")
  const formatTime = (time: string) => {
    const parts = time.split(':');
    const hours = Number(parts[0] ?? 0);
    const minutes = Number(parts[1] ?? 0);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <Clock className="h-12 w-12 mb-2 opacity-50" aria-hidden="true" />
        <p className="text-sm">{t('selectDateFirst')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="time-slot-loading">
        <Loader2 className="h-8 w-8 animate-spin text-burgundy-600" aria-hidden="true" />
        <span className="sr-only">{tCommon('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-red-500" data-testid="time-slot-error">
        <p className="text-sm mb-3">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTimeSlots}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
              Retry
            </>
          )}
        </Button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <Clock className="h-12 w-12 mb-2 opacity-50" aria-hidden="true" />
        <p className="text-sm">{t('noAvailability')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="time-slot-grid">
      {slots.map((slot) => {
        const isSelected = selectedTime === slot.timeSlot;
        const isFull = !slot.available;
        const isLowCapacity = slot.available && slot.remainingCapacity <= 3;
        const capacityPercent = slot.maxCapacity > 0
          ? Math.round((slot.remainingCapacity / slot.maxCapacity) * 100)
          : 0;

        return (
          <button
            key={slot.timeSlot}
            onClick={() => handleSlotSelect(slot)}
            disabled={isFull}
            className={cn(
              'relative flex flex-col rounded-xl border-2 px-4 py-3.5 text-left transition-all',
              isFull
                ? 'border-stone-100 bg-stone-50 cursor-not-allowed opacity-60'
                : isSelected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-primary/40 hover:bg-primary/[0.02]'
            )}
          >
            {/* Time range */}
            <div className="flex items-center justify-between">
              <span className={cn(
                'text-base font-semibold',
                isFull ? 'text-muted-foreground' : 'text-foreground'
              )}>
                {formatTime(slot.timeSlot)} → {formatTime(slot.endTime)}
              </span>
              {isFull && (
                <span className="text-xs font-medium text-muted-foreground bg-stone-100 px-2 py-0.5 rounded-full">
                  {t('sessionFull')}
                </span>
              )}
              {isLowCapacity && (
                <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  {t('spotsLeft', { count: slot.remainingCapacity })}
                </span>
              )}
            </div>

            {/* Capacity bar */}
            {!isFull && (
              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      isLowCapacity ? 'bg-orange-400' : 'bg-primary/60'
                    )}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>
                <span className={cn(
                  'text-xs whitespace-nowrap',
                  isLowCapacity ? 'text-orange-600 font-medium' : 'text-muted-foreground'
                )} data-testid="remaining-capacity">
                  {t('spotsLeft', { count: slot.remainingCapacity })}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
