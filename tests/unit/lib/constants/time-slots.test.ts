import { describe, it, expect } from 'vitest';
import {
  TIME_SLOTS,
  DAYS_OF_WEEK,
  DAYS_OF_WEEK_ORDERED,
  calculateEndTime,
  doSlotsOverlap,
  hasOverlappingSlots,
  formatTimeDisplay,
} from '@/lib/constants/time-slots';

describe('TIME_SLOTS', () => {
  it('generates 30-minute increments from 08:00 to 20:00', () => {
    expect(TIME_SLOTS[0]).toBe('08:00');
    expect(TIME_SLOTS[1]).toBe('08:30');
    expect(TIME_SLOTS[TIME_SLOTS.length - 1]).toBe('20:00');
    expect(TIME_SLOTS.length).toBe(25);
  });

  it('all slots are in HH:mm format', () => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    for (const slot of TIME_SLOTS) {
      expect(slot).toMatch(timeRegex);
    }
  });
});

describe('DAYS_OF_WEEK', () => {
  it('has 7 days', () => {
    expect(DAYS_OF_WEEK.length).toBe(7);
  });

  it('Sunday is 0, Saturday is 6', () => {
    expect(DAYS_OF_WEEK[0].value).toBe(0);
    expect(DAYS_OF_WEEK[0].label).toBe('Sunday');
    expect(DAYS_OF_WEEK[6].value).toBe(6);
    expect(DAYS_OF_WEEK[6].label).toBe('Saturday');
  });
});

describe('DAYS_OF_WEEK_ORDERED', () => {
  it('starts with Monday (European convention)', () => {
    expect(DAYS_OF_WEEK_ORDERED[0].value).toBe(1);
    expect(DAYS_OF_WEEK_ORDERED[0].label).toBe('Monday');
  });

  it('ends with Sunday', () => {
    expect(DAYS_OF_WEEK_ORDERED[6].value).toBe(0);
    expect(DAYS_OF_WEEK_ORDERED[6].label).toBe('Sunday');
  });
});

describe('calculateEndTime', () => {
  it('calculates end time from start and duration', () => {
    expect(calculateEndTime('09:00', 60)).toBe('10:00');
    expect(calculateEndTime('09:00', 90)).toBe('10:30');
    expect(calculateEndTime('09:30', 60)).toBe('10:30');
  });

  it('handles crossing hour boundaries', () => {
    expect(calculateEndTime('10:30', 60)).toBe('11:30');
    expect(calculateEndTime('23:00', 60)).toBe('24:00');
  });

  it('handles multi-hour durations', () => {
    expect(calculateEndTime('09:00', 180)).toBe('12:00');
    expect(calculateEndTime('10:00', 240)).toBe('14:00');
  });

  it('handles 30-minute increments', () => {
    expect(calculateEndTime('09:00', 30)).toBe('09:30');
    expect(calculateEndTime('09:30', 30)).toBe('10:00');
  });
});

describe('doSlotsOverlap', () => {
  it('returns true for overlapping slots', () => {
    expect(
      doSlotsOverlap(
        { startTime: '09:00', endTime: '11:00' },
        { startTime: '10:00', endTime: '12:00' }
      )
    ).toBe(true);
  });

  it('returns true when one slot contains another', () => {
    expect(
      doSlotsOverlap(
        { startTime: '09:00', endTime: '13:00' },
        { startTime: '10:00', endTime: '12:00' }
      )
    ).toBe(true);
  });

  it('returns false for non-overlapping slots', () => {
    expect(
      doSlotsOverlap(
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '11:00', endTime: '12:00' }
      )
    ).toBe(false);
  });

  it('returns false for adjacent slots (end equals start)', () => {
    expect(
      doSlotsOverlap(
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' }
      )
    ).toBe(false);
  });
});

describe('hasOverlappingSlots', () => {
  it('returns false for empty array', () => {
    expect(hasOverlappingSlots([])).toBe(false);
  });

  it('returns false for single slot', () => {
    expect(
      hasOverlappingSlots([{ startTime: '09:00', endTime: '10:00' }])
    ).toBe(false);
  });

  it('returns false for non-overlapping slots', () => {
    expect(
      hasOverlappingSlots([
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '11:00', endTime: '12:00' },
        { startTime: '14:00', endTime: '15:00' },
      ])
    ).toBe(false);
  });

  it('returns true when any slots overlap', () => {
    expect(
      hasOverlappingSlots([
        { startTime: '09:00', endTime: '11:00' },
        { startTime: '10:00', endTime: '12:00' },
      ])
    ).toBe(true);
  });

  it('handles unsorted slots correctly', () => {
    expect(
      hasOverlappingSlots([
        { startTime: '14:00', endTime: '15:00' },
        { startTime: '09:00', endTime: '11:00' },
        { startTime: '10:00', endTime: '12:00' },
      ])
    ).toBe(true);
  });

  it('returns false for adjacent slots', () => {
    expect(
      hasOverlappingSlots([
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' },
        { startTime: '11:00', endTime: '12:00' },
      ])
    ).toBe(false);
  });
});

describe('formatTimeDisplay', () => {
  it('formats morning times in 24-hour format', () => {
    expect(formatTimeDisplay('08:00')).toBe('08:00');
    expect(formatTimeDisplay('09:30')).toBe('09:30');
    expect(formatTimeDisplay('11:00')).toBe('11:00');
  });

  it('formats noon correctly', () => {
    expect(formatTimeDisplay('12:00')).toBe('12:00');
    expect(formatTimeDisplay('12:30')).toBe('12:30');
  });

  it('formats afternoon times in 24-hour format', () => {
    expect(formatTimeDisplay('13:00')).toBe('13:00');
    expect(formatTimeDisplay('14:30')).toBe('14:30');
    expect(formatTimeDisplay('20:00')).toBe('20:00');
  });

  it('formats midnight correctly', () => {
    expect(formatTimeDisplay('00:00')).toBe('00:00');
    expect(formatTimeDisplay('00:30')).toBe('00:30');
  });
});
