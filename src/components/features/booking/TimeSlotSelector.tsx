'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, Loader2 } from 'lucide-react';
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
  const [slots, setSlots] = useState<TimeSlotAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    getTimeSlotsForDate(experienceId, selectedDate).then((result) => {
      if (result.success) {
        setSlots(result.data);
        // If previously selected time is not available, clear it
        if (selectedTime && !result.data.find((s) => s.timeSlot === selectedTime)?.available) {
          onTimeChange(null);
          onCapacityUpdate(null);
        }
      } else {
        setError(result.error.message);
        setSlots([]);
      }
      setIsLoading(false);
    });
  }, [experienceId, selectedDate, selectedTime, onTimeChange, onCapacityUpdate]);

  const handleSlotSelect = (slot: TimeSlotAvailability) => {
    if (!slot.available) return;
    onTimeChange(slot.timeSlot);
    onCapacityUpdate(slot.remainingCapacity);
  };

  // Format time for display (e.g., "10:00" -> "10:00 AM")
  const formatTime = (time: string) => {
    const parts = time.split(':');
    const hours = Number(parts[0] ?? 0);
    const minutes = Number(parts[1] ?? 0);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <Clock className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm">{t('selectDateFirst')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-burgundy-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-red-500">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <Clock className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm">{t('noAvailability')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {slots.map((slot) => (
        <button
          key={slot.timeSlot}
          onClick={() => handleSlotSelect(slot)}
          disabled={!slot.available}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-lg border-2 px-4 py-3 transition-all',
            slot.available
              ? selectedTime === slot.timeSlot
                ? 'border-burgundy-600 bg-burgundy-50 text-burgundy-900'
                : 'border-stone-200 bg-white hover:border-burgundy-300 hover:bg-burgundy-50/50'
              : 'border-stone-100 bg-stone-50 text-slate-300 cursor-not-allowed'
          )}
        >
          <span className="text-sm font-medium">{formatTime(slot.timeSlot)}</span>
          {slot.available ? (
            <span className="mt-1 text-xs text-slate-500">
              {t('remainingCapacity', { count: slot.remainingCapacity })}
            </span>
          ) : (
            <span className="mt-1 text-xs">{t('unavailable')}</span>
          )}
        </button>
      ))}
    </div>
  );
}
