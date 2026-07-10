'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TimeSlotEditorProps {
  start: string;
  end: string;
  onSave: (_startTime: string, _endTime: string) => void;
  onCancel: () => void;
}

/**
 * Converts a time string (HH:MM) to total minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Validates that a time slot has end > start and minimum 30 minutes duration.
 */
function isValidTimeSlot(start: string, end: string): boolean {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return endMinutes > startMinutes && endMinutes - startMinutes >= 30;
}

export function TimeSlotEditor({
  start,
  end,
  onSave,
  onCancel,
}: TimeSlotEditorProps) {
  const t = useTranslations('experience');
  const [startTime, setStartTime] = useState(start);
  const [endTime, setEndTime] = useState(end);
  const [error, setError] = useState<string | null>(null);

  // Validate whenever times change
  useEffect(() => {
    if (!startTime || !endTime) {
      setError(null);
      return;
    }
    if (!isValidTimeSlot(startTime, endTime)) {
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      if (endMinutes <= startMinutes) {
        setError(t('timeSlots.endAfterStart'));
      } else {
        setError(t('timeSlots.minDuration'));
      }
    } else {
      setError(null);
    }
  }, [startTime, endTime, t]);

  const handleSave = () => {
    if (!isValidTimeSlot(startTime, endTime)) {
      return;
    }
    onSave(startTime, endTime);
  };

  return (
    <div className="flex items-center gap-2 rounded border border-primary bg-white px-3 py-2">
      <Input
        type="time"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        className="h-8 w-28 text-sm"
        aria-label={t('startTime')}
      />
      <span className="text-muted-foreground">-</span>
      <Input
        type="time"
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
        className="h-8 w-28 text-sm"
        aria-label={t('endTime')}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleSave}
        disabled={!!error}
        className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
        aria-label={t('saveTimeSlot')}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onCancel}
        className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={t('cancelEditing')}
      >
        <X className="h-4 w-4" />
      </Button>
      {error && <span className="ml-2 text-xs text-destructive">{error}</span>}
    </div>
  );
}
