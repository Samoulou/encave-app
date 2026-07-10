import { describe, it, expect } from 'vitest';
import {
  isDateKey,
  isMonthKey,
  localDateFromKey,
  localDateKey,
  shiftMonthKey,
  upcomingWeekendRange,
} from '@/lib/utils/date-key';

describe('localDateKey', () => {
  it('serializes a local-midnight date to its calendar day', () => {
    expect(localDateKey(new Date(2026, 6, 9))).toBe('2026-07-09');
  });

  it('pads single-digit months and days', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('keeps the LOCAL calendar day for late-evening times (no UTC shift)', () => {
    // 23:30 local — toISOString() would flip the day west of UTC+0.
    expect(localDateKey(new Date(2026, 6, 9, 23, 30))).toBe('2026-07-09');
  });
});

describe('localDateFromKey', () => {
  it('round-trips with localDateKey', () => {
    const date = localDateFromKey('2026-07-09');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(9);
    expect(localDateKey(date)).toBe('2026-07-09');
  });
});

describe('isDateKey', () => {
  it('accepts a valid calendar date', () => {
    expect(isDateKey('2026-07-09')).toBe(true);
    expect(isDateKey('2026-12-31')).toBe(true);
  });

  it('rejects malformed keys', () => {
    expect(isDateKey('2026-7-9')).toBe(false);
    expect(isDateKey('09-07-2026')).toBe(false);
    expect(isDateKey('2026-07-09T00:00:00Z')).toBe(false);
    expect(isDateKey('')).toBe(false);
  });

  it('rejects impossible calendar dates', () => {
    expect(isDateKey('2026-02-31')).toBe(false);
    expect(isDateKey('2026-04-31')).toBe(false);
    expect(isDateKey('2025-02-29')).toBe(false); // not a leap year
  });

  it('accepts leap-day on leap years', () => {
    expect(isDateKey('2028-02-29')).toBe(true);
  });
});

describe('isMonthKey', () => {
  it('accepts YYYY-MM', () => {
    expect(isMonthKey('2026-07')).toBe(true);
    expect(isMonthKey('2026-12')).toBe(true);
  });

  it('rejects out-of-range months and malformed keys', () => {
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-0')).toBe(false);
    expect(isMonthKey('2026-07-09')).toBe(false);
    expect(isMonthKey('')).toBe(false);
  });
});

describe('shiftMonthKey', () => {
  it('shifts within a year', () => {
    expect(shiftMonthKey('2026-07', 1)).toBe('2026-08');
    expect(shiftMonthKey('2026-07', -1)).toBe('2026-06');
  });

  it('wraps across year boundaries', () => {
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
  });

  it('handles multi-month deltas', () => {
    expect(shiftMonthKey('2026-07', 18)).toBe('2028-01');
    expect(shiftMonthKey('2026-07', -19)).toBe('2024-12');
  });

  it('is a no-op for delta 0', () => {
    expect(shiftMonthKey('2026-07', 0)).toBe('2026-07');
  });
});

describe('upcomingWeekendRange', () => {
  it('targets the coming Saturday + Sunday from a weekday', () => {
    // Thursday 2026-07-09 → sat 11 + sun 12.
    expect(upcomingWeekendRange(new Date(2026, 6, 9))).toEqual({
      from: '2026-07-11',
      to: '2026-07-12',
    });
  });

  it('keeps the current weekend on a Saturday', () => {
    expect(upcomingWeekendRange(new Date(2026, 6, 11))).toEqual({
      from: '2026-07-11',
      to: '2026-07-12',
    });
  });

  it('collapses to today on a Sunday', () => {
    expect(upcomingWeekendRange(new Date(2026, 6, 12))).toEqual({
      from: '2026-07-12',
      to: '2026-07-12',
    });
  });

  it('crosses month boundaries', () => {
    // Friday 2026-07-31 → sat 2026-08-01 + sun 2026-08-02.
    expect(upcomingWeekendRange(new Date(2026, 6, 31))).toEqual({
      from: '2026-08-01',
      to: '2026-08-02',
    });
  });
});
