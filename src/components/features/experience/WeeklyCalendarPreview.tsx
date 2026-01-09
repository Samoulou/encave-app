'use client';

import { DAYS_OF_WEEK_ORDERED } from '@/lib/constants/time-slots';
import { cn } from '@/lib/utils';

interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface WeeklyCalendarPreviewProps {
  slots: Slot[];
}

export function WeeklyCalendarPreview({ slots }: WeeklyCalendarPreviewProps) {
  // Group slots by day
  const slotsByDay: Record<number, Slot[]> = {};
  for (const slot of slots) {
    const daySlots = slotsByDay[slot.dayOfWeek] ?? [];
    daySlots.push(slot);
    slotsByDay[slot.dayOfWeek] = daySlots;
  }

  // Sort slots within each day
  for (const day of Object.keys(slotsByDay)) {
    const dayNum = parseInt(day);
    const daySlots = slotsByDay[dayNum];
    if (daySlots) {
      slotsByDay[dayNum] = daySlots.sort((a: Slot, b: Slot) =>
        a.startTime.localeCompare(b.startTime)
      );
    }
  }

  const hasAnySlots = slots.length > 0;
  const hasActiveSlots = slots.some((s) => s.isActive);

  if (!hasAnySlots) {
    return (
      <div className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-8 text-center">
        <p className="text-slate-500">
          No availability configured. Add time slots above to preview your weekly schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
        {DAYS_OF_WEEK_ORDERED.map((day) => (
          <div
            key={day.value}
            className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider"
          >
            {day.shortLabel}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 min-h-[120px]">
        {DAYS_OF_WEEK_ORDERED.map((day) => {
          const daySlots = slotsByDay[day.value] ?? [];
          const hasSlots = daySlots.length > 0;

          return (
            <div
              key={day.value}
              className={cn(
                'border-r border-stone-100 last:border-r-0 p-2 min-h-[100px]',
                hasSlots ? 'bg-white' : 'bg-stone-50/50'
              )}
            >
              {daySlots.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <span className="text-xs text-slate-300">-</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {daySlots.map((slot: Slot, idx: number) => (
                    <div
                      key={`${day.value}-${idx}`}
                      className={cn(
                        'rounded px-1.5 py-1 text-center text-xs font-medium transition-colors',
                        slot.isActive
                          ? 'bg-burgundy-100 text-burgundy-700 border border-burgundy-200'
                          : 'bg-stone-100 text-stone-400 line-through'
                      )}
                      title={slot.isActive ? 'Active' : 'Disabled'}
                    >
                      <div className="truncate">
                        {slot.startTime}
                      </div>
                      <div className="truncate text-[10px] opacity-75">
                        {slot.endTime}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="border-t border-stone-200 bg-stone-50 px-4 py-2 text-xs text-slate-600">
        {hasActiveSlots ? (
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {slots.filter((s) => s.isActive).length} active slot(s) configured
          </span>
        ) : (
          <span className="flex items-center gap-2 text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            All slots are disabled - visitors cannot book
          </span>
        )}
      </div>
    </div>
  );
}
