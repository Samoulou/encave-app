'use client';

import { Calendar, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface AvailabilityDisplayProps {
  slots: AvailabilitySlot[];
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours || '0', 10);
  const m = minutes || '00';
  return `${h.toString().padStart(2, '0')}:${m}`;
}

export function AvailabilityDisplay({ slots }: AvailabilityDisplayProps) {
  const t = useTranslations('experience.availability');
  const tDays = useTranslations('common.days.full');
  if (!slots || slots.length === 0) {
    return null;
  }

  // Group slots by day
  const slotsByDay = slots.reduce(
    (acc, slot) => {
      if (!acc[slot.dayOfWeek]) {
        acc[slot.dayOfWeek] = [];
      }
      acc[slot.dayOfWeek]!.push(slot);
      return acc;
    },
    {} as Record<number, AvailabilitySlot[]>
  );

  // Get available days sorted
  const availableDays = Object.keys(slotsByDay)
    .map(Number)
    .sort((a, b) => {
      // Sort Monday first (1), then through Sunday (0)
      const orderA = a === 0 ? 7 : a;
      const orderB = b === 0 ? 7 : b;
      return orderA - orderB;
    });

  return (
    <section className="mt-8">
      <h3 className="mb-4 flex items-center gap-2 text-2xl font-bold text-foreground">
        <Calendar className="h-6 w-6 text-primary" />
        {t('title')}
      </h3>
      <div className="rounded-xl border border-stone-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {availableDays.map((day) => (
            <div
              key={day}
              className="flex items-center justify-between rounded-lg border border-stone-100 bg-white p-3"
            >
              <span className="font-medium text-slate-700">
                {tDays(String(day))}
              </span>
              <div className="flex flex-wrap justify-end gap-2">
                {slotsByDay[day]?.map((slot, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-sm text-slate-600"
                  >
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {availableDays.length === 0 && (
          <p className="py-4 text-center text-slate-500">
            {t('noAvailabilityContact')}
          </p>
        )}
      </div>
    </section>
  );
}
