'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getTimeSlotsForDate,
  type TimeSlotAvailability,
} from '@/server/actions/booking';

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
          if (selectedTime) {
            const selectedSlot = result.data.find(
              (slot) => slot.timeSlot === selectedTime
            );
            if (selectedSlot?.available) {
              onCapacityUpdate(selectedSlot.remainingCapacity);
            } else {
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
  }, [
    experienceId,
    selectedDate,
    selectedTime,
    onTimeChange,
    onCapacityUpdate,
  ]);

  useEffect(() => {
    fetchTimeSlots();
  }, [fetchTimeSlots]);

  const handleSlotSelect = (slot: TimeSlotAvailability) => {
    if (!slot.available) return;
    onTimeChange(slot.timeSlot);
    onCapacityUpdate(slot.remainingCapacity);
  };

  const formatTime = (time: string) => {
    const parts = time.split(':');
    const hours = Number(parts[0] ?? 0);
    const minutes = Number(parts[1] ?? 0);
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
  };

  if (!selectedDate) {
    return (
      <div className="rounded-[10px] border border-dashed border-stone-200 px-3 py-5 text-center text-xs text-ink-500">
        <Clock className="mx-auto mb-2 h-6 w-6 opacity-50" aria-hidden="true" />
        <p>{t('selectDateFirst')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-5"
        data-testid="time-slot-loading"
      >
        <Loader2
          className="h-5 w-5 animate-spin text-burgundy-600"
          aria-hidden="true"
        />
        <span className="sr-only">{tCommon('loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-[10px] border border-stone-200 px-3 py-5 text-center text-red-500"
        data-testid="time-slot-error"
      >
        <p className="mb-3 text-xs">{error}</p>
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
              <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
              Retry
            </>
          )}
        </Button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-stone-200 px-3 py-5 text-center text-xs text-ink-500">
        <Clock className="mx-auto mb-2 h-6 w-6 opacity-50" aria-hidden="true" />
        <p>{t('noAvailability')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5" data-testid="time-slot-grid">
      {slots.map((slot) => {
        const isSelected = selectedTime === slot.timeSlot;
        const isFull = !slot.available;
        const isLowCapacity = slot.available && slot.remainingCapacity <= 3;
        const isSunsetSlot = formatTime(slot.timeSlot).startsWith('17');

        return (
          <button
            key={slot.timeSlot}
            onClick={() => handleSlotSelect(slot)}
            disabled={isFull}
            className={cn(
              'h-[54px] rounded-[10px] border-[1.5px] px-2.5 text-left transition-all',
              isFull
                ? 'cursor-not-allowed border-stone-200 bg-stone-50 opacity-50'
                : isSelected
                  ? 'border-burgundy-600 bg-burgundy-50'
                  : 'border-stone-200 bg-white hover:border-burgundy-200'
            )}
          >
            <div
              className={cn(
                'text-sm font-bold',
                isFull ? 'text-ink-300' : 'text-ink-900'
              )}
            >
              {formatTime(slot.timeSlot)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-ink-500">
              <span
                className={cn(isLowCapacity && 'font-semibold text-gold-700')}
              >
                {isSunsetSlot ? 'coucher' : ''}
              </span>
              <span className="font-mono" data-testid="remaining-capacity">
                {isFull
                  ? t('sessionFull')
                  : t('spotsLeft', { count: slot.remainingCapacity })}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
