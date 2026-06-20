import { useTranslations } from 'next-intl';
import { CalendarClock, Clock, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeSlotEditor } from '../TimeSlotEditor';
import { SectionHeader } from './SectionHeader';
import { DAYS_OF_WEEK } from './types';
import type { AvailabilitySlot, DayOfWeek } from './types';

// Maps day codes to JS day indices used by the shared common.days.short keys.
const DAY_TO_INDEX: Record<DayOfWeek, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

interface AvailabilitySectionProps {
  availabilitySlots: AvailabilitySlot[];
  editingTimeSlot: { slotId: string; timeSlotIndex: number } | null;
  onDayToggle: (
    _slotId: string,
    _dayValue: string,
    _isSelected: boolean
  ) => void;
  onEditTimeSlot: (_slotId: string, _timeSlotIndex: number) => void;
  onSaveTimeSlot: (_start: string, _end: string) => void;
  onCancelEdit: () => void;
  onDeleteTimeSlot: (_slotId: string, _timeSlotIndex: number) => void;
  onAddTimeSlot: (_slotId: string) => void;
  onDeletePattern: (_slotId: string) => void;
  onAddPattern: () => void;
  sectionRef: (_el: HTMLElement | null) => void;
}

export function AvailabilitySection({
  availabilitySlots,
  editingTimeSlot,
  onDayToggle,
  onEditTimeSlot,
  onSaveTimeSlot,
  onCancelEdit,
  onDeleteTimeSlot,
  onAddTimeSlot,
  onDeletePattern,
  onAddPattern,
  sectionRef,
}: AvailabilitySectionProps) {
  const t = useTranslations('experience');
  const tCommon = useTranslations('common');

  return (
    <section
      ref={sectionRef}
      id="availability"
      className="scroll-mt-24 rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
    >
      <SectionHeader icon={CalendarClock} title={t('availability.title')} />
      <div className="space-y-4">
        {/* Availability Slots */}
        {availabilitySlots.map((slot) => (
          <div
            key={slot.id}
            className="rounded-lg border border-stone-200 bg-muted p-4"
          >
            {/* Pattern Header with Delete */}
            <div className="mb-4 flex items-center justify-between">
              {/* Day Selector */}
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = slot.days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={cn(
                        'rounded px-3 py-1 text-xs font-bold transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-stone-200 bg-white text-muted-foreground'
                      )}
                      onClick={() =>
                        onDayToggle(slot.id, day.value, isSelected)
                      }
                    >
                      {tCommon(`days.short.${DAY_TO_INDEX[day.value]}`)}
                    </button>
                  );
                })}
              </div>
              {/* Delete Pattern Button */}
              <button
                type="button"
                onClick={() => onDeletePattern(slot.id)}
                className="p-1 text-slate-400 transition-colors hover:text-red-500"
                aria-label={t('deleteSchedulePattern')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Time Slots */}
            <div className="flex flex-wrap items-center gap-3">
              {slot.timeSlots.map((timeSlot, idx) => {
                const isEditing =
                  editingTimeSlot?.slotId === slot.id &&
                  editingTimeSlot?.timeSlotIndex === idx;

                if (isEditing) {
                  return (
                    <TimeSlotEditor
                      key={idx}
                      start={timeSlot.start}
                      end={timeSlot.end}
                      onSave={onSaveTimeSlot}
                      onCancel={onCancelEdit}
                    />
                  );
                }

                return (
                  <div
                    key={idx}
                    className="group flex items-center gap-2 rounded border border-stone-200 bg-white px-3 py-2"
                  >
                    <Clock
                      className="h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium">
                      {timeSlot.start}
                    </span>
                    <span className="text-slate-300">-</span>
                    <span className="text-sm font-medium">{timeSlot.end}</span>
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => onEditTimeSlot(slot.id, idx)}
                      className="ml-2 text-xs font-bold text-primary opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                    >
                      {tCommon('buttons.edit')}
                    </button>
                    {/* Delete Time Slot Button */}
                    <button
                      type="button"
                      onClick={() => onDeleteTimeSlot(slot.id, idx)}
                      className="text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      aria-label={t('deleteTimeSlot')}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}

              {/* Add Time Slot Button */}
              <button
                type="button"
                onClick={() => onAddTimeSlot(slot.id)}
                className="flex items-center gap-1 rounded border border-dashed border-primary/30 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('availability.addTime')}
              </button>
            </div>
          </div>
        ))}

        {/* Add Schedule Button */}
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 py-3 text-sm font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          onClick={onAddPattern}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('availability.addSchedulePattern')}
        </button>
      </div>
    </section>
  );
}
