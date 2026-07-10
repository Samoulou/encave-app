'use client';

import { Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface AvailabilityPreviewProps {
  slots: AvailabilitySlot[];
}

function formatTime(time: string): string {
  // Convert "HH:mm" to more readable format
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours ?? '0', 10);
  const min = minutes ?? '00';
  return `${hour}:${min}`;
}

function groupSlotsByDay(
  slots: AvailabilitySlot[]
): Map<number, AvailabilitySlot[]> {
  const grouped = new Map<number, AvailabilitySlot[]>();
  for (const slot of slots) {
    const existing = grouped.get(slot.dayOfWeek) ?? [];
    existing.push(slot);
    grouped.set(slot.dayOfWeek, existing);
  }
  return grouped;
}

export function AvailabilityPreview({ slots }: AvailabilityPreviewProps) {
  const t = useTranslations('experience.availability');
  const tDaysFull = useTranslations('common.days.full');
  const tDaysShort = useTranslations('common.days.short');

  if (slots.length === 0) {
    return (
      <section
        className="rounded-xl bg-white p-6 shadow-warm lg:p-8"
        data-testid="availability-preview"
      >
        <h2 className="font-display text-xl font-semibold text-foreground">
          {t('title')}
        </h2>
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-amber-50 p-4 text-amber-800">
          <Calendar className="h-5 w-5 shrink-0" />
          <p className="text-sm">{t('noScheduleContact')}</p>
        </div>
      </section>
    );
  }

  const groupedSlots = groupSlotsByDay(slots);
  const availableDays = Array.from(groupedSlots.keys()).sort((a, b) => a - b);

  return (
    <section
      className="rounded-xl bg-white p-6 shadow-warm lg:p-8"
      data-testid="availability-preview"
    >
      <h2 className="font-display text-xl font-semibold text-foreground">
        {t('title')}
      </h2>

      {/* Days indicator - visual representation */}
      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const isAvailable = groupedSlots.has(day);
          return (
            <div
              key={day}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg text-xs font-medium',
                isAvailable
                  ? 'bg-burgundy-100 text-burgundy-800'
                  : 'bg-stone-100 text-stone-400'
              )}
              title={tDaysFull(String(day))}
            >
              {tDaysShort(String(day))}
            </div>
          );
        })}
      </div>

      {/* Time slots by day */}
      <div className="mt-6 space-y-3">
        {availableDays.map((day) => {
          const daySlots = groupedSlots.get(day) ?? [];
          return (
            <div
              key={day}
              className="flex items-start gap-4 border-b border-stone-100 pb-3 last:border-0"
            >
              <span className="w-24 shrink-0 text-sm font-medium text-muted-foreground">
                {tDaysFull(String(day))}
              </span>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <span
                    key={slot.id}
                    className="rounded-md bg-burgundy-50 px-3 py-1 text-sm text-burgundy-700"
                    data-testid="availability-slot"
                  >
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
