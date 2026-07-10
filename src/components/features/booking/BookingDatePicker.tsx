'use client';

import { useMemo, useCallback } from 'react';
import { format, addMonths, startOfDay, isBefore } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';

interface BookingDatePickerProps {
  selectedDate: string | null;
  onDateChange: (_date: string | null) => void;
  availableDays: Set<number>;
  /**
   * "YYYY-MM-DD" keys of bookable occurrences (P-05) — a date is
   * selectable when its weekday has a slot OR its key is in this set
   * (punctual occurrences on off-schedule days).
   */
  occurrenceDateKeys?: Set<string>;
}

const NO_OCCURRENCE_DATES: Set<string> = new Set();

export function BookingDatePicker({
  selectedDate,
  onDateChange,
  availableDays,
  occurrenceDateKeys = NO_OCCURRENCE_DATES,
}: BookingDatePickerProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => addMonths(today, 3), [today]); // Allow booking up to 3 months ahead

  const selected = selectedDate ? new Date(selectedDate) : undefined;

  // Function to determine if a date should be disabled
  const isDateDisabled = useCallback(
    (date: Date): boolean => {
      // Disable past dates (but not today)
      if (isBefore(startOfDay(date), today)) {
        return true;
      }

      // Disable dates beyond max booking window
      if (isBefore(maxDate, date)) {
        return true;
      }

      // Disable days without a weekly slot UNLESS a punctual occurrence
      // exists on that exact date (P-05).
      const dayOfWeek = date.getDay();
      if (
        !availableDays.has(dayOfWeek) &&
        !occurrenceDateKeys.has(format(date, 'yyyy-MM-dd'))
      ) {
        return true;
      }

      return false;
    },
    [today, maxDate, availableDays, occurrenceDateKeys]
  );

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Format as YYYY-MM-DD for URL state
      const formatted = format(date, 'yyyy-MM-dd');
      onDateChange(formatted);
    } else {
      onDateChange(null);
    }
  };

  // Custom day render to show today indicator
  const modifiers = useMemo(
    () => ({
      today: today,
      unavailable: isDateDisabled,
    }),
    [today, isDateDisabled]
  );

  const modifiersClassNames = {
    today: 'border-2 border-burgundy-500',
    unavailable: 'text-muted-foreground line-through cursor-not-allowed',
  };

  return (
    <div className="flex justify-center">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={handleSelect}
        disabled={isDateDisabled}
        fromDate={today}
        toDate={maxDate}
        modifiers={modifiers}
        modifiersClassNames={modifiersClassNames}
        className="rounded-lg border-0"
        classNames={{
          // BUG-033 FIX: Updated to react-day-picker v9 class names
          months:
            'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
          month: 'space-y-4',
          month_caption: 'flex justify-center pt-1 relative items-center',
          caption_label: 'text-sm font-medium text-foreground',
          nav: 'space-x-1 flex items-center',
          button_previous:
            'h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-muted rounded-md transition-colors absolute left-1 right-auto',
          button_next:
            'h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-muted rounded-md transition-colors absolute right-1 left-auto',
          month_grid: 'w-full border-collapse space-y-1',
          weekdays: 'flex',
          weekday:
            'text-muted-foreground rounded-md w-10 font-normal text-[0.8rem]',
          week: 'flex w-full mt-2',
          day: 'h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
          day_button:
            'h-10 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-burgundy-50 rounded-md transition-colors',
          selected:
            'bg-burgundy-600 text-white hover:bg-burgundy-600 hover:text-white focus:bg-burgundy-600 focus:text-white',
          outside: 'text-muted-foreground opacity-50',
          disabled:
            'text-muted-foreground opacity-50 cursor-not-allowed hover:bg-transparent',
          range_middle:
            'aria-selected:bg-burgundy-100 aria-selected:text-burgundy-900',
          hidden: 'invisible',
        }}
      />
    </div>
  );
}
