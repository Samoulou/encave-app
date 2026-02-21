import { CalendarClock, Clock, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeSlotEditor } from '../TimeSlotEditor';
import { SectionHeader } from './SectionHeader';
import { DAYS_OF_WEEK } from './types';
import type { AvailabilitySlot } from './types';

interface AvailabilitySectionProps {
  availabilitySlots: AvailabilitySlot[];
  editingTimeSlot: { slotId: string; timeSlotIndex: number } | null;
  onDayToggle: (_slotId: string, _dayValue: string, _isSelected: boolean) => void;
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
  return (
    <section
      ref={sectionRef}
      id="availability"
      className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
    >
      <SectionHeader icon={CalendarClock} title="Availability" />
      <div className="space-y-4">
        {/* Availability Slots */}
        {availabilitySlots.map((slot) => (
          <div
            key={slot.id}
            className="bg-slate-50 rounded-lg p-4 border border-stone-200"
          >
            {/* Pattern Header with Delete */}
            <div className="flex items-center justify-between mb-4">
              {/* Day Selector */}
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = slot.days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={cn(
                        'px-3 py-1 text-xs font-bold rounded transition-colors',
                        isSelected
                          ? 'bg-primary text-white'
                          : 'bg-white text-slate-400 border border-stone-200'
                      )}
                      onClick={() => onDayToggle(slot.id, day.value, isSelected)}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {/* Delete Pattern Button */}
              <button
                type="button"
                onClick={() => onDeletePattern(slot.id)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                aria-label="Delete schedule pattern"
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
                    className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-stone-200 group"
                  >
                    <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span className="text-sm font-medium">{timeSlot.start}</span>
                    <span className="text-slate-300">-</span>
                    <span className="text-sm font-medium">{timeSlot.end}</span>
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => onEditTimeSlot(slot.id, idx)}
                      className="ml-2 text-primary text-xs font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Edit
                    </button>
                    {/* Delete Time Slot Button */}
                    <button
                      type="button"
                      onClick={() => onDeleteTimeSlot(slot.id, idx)}
                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete time slot"
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
                className="flex items-center gap-1 px-3 py-2 text-sm text-primary font-medium hover:bg-primary/5 rounded border border-dashed border-primary/30 transition-colors"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add time
              </button>
            </div>
          </div>
        ))}

        {/* Add Schedule Button */}
        <button
          type="button"
          className="w-full py-3 border-2 border-dashed border-stone-300 rounded-lg text-slate-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors"
          onClick={onAddPattern}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Schedule Pattern
        </button>
      </div>
    </section>
  );
}
