import { addDays, nextSaturday } from 'date-fns';

/**
 * Local-calendar date keys ("YYYY-MM-DD") and month keys ("YYYY-MM") for
 * URL params and picker state (P-05 / L-110, L-111, L-131, L-132).
 *
 * react-day-picker returns LOCAL-midnight Dates; serializing them with
 * toISOString() would shift the calendar day for any timezone ahead of
 * UTC (Europe/Zurich included). These helpers read/write local
 * wall-clock components only. For UTC-midnight DB dates, use
 * `dateKeyOf()` from `@/lib/business-rules/occurrence-expansion`.
 */

const DATE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "YYYY-MM-DD" key of a Date, using LOCAL calendar components. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local-midnight Date for a "YYYY-MM-DD" key (picker selection state). */
export function localDateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/**
 * True when `value` is a well-formed "YYYY-MM-DD" key naming a REAL
 * calendar date (rejects e.g. "2026-02-31", which would otherwise reach
 * Prisma as an Invalid Date).
 */
export function isDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === (month ?? 1) - 1 &&
    date.getUTCDate() === day
  );
}

/** True when `value` is a well-formed "YYYY-MM" month key. */
export function isMonthKey(value: string): boolean {
  return MONTH_KEY_PATTERN.test(value);
}

/**
 * Shift a "YYYY-MM" month key by `delta` months (integer month
 * arithmetic — no Date object involved, so no timezone drift).
 */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const total = (year ?? 0) * 12 + (month ?? 1) - 1 + delta;
  const shiftedYear = Math.floor(total / 12);
  const shiftedMonth = total - shiftedYear * 12;
  return `${String(shiftedYear).padStart(4, '0')}-${String(
    shiftedMonth + 1
  ).padStart(2, '0')}`;
}

export interface WeekendRange {
  /** "YYYY-MM-DD" of the weekend's first bookable day. */
  from: string;
  /** "YYYY-MM-DD" of the weekend's last day (inclusive). */
  to: string;
}

/**
 * The upcoming weekend as LOCAL date keys ("Ce week-end" hero chip,
 * L-111): the next Saturday + Sunday — or what remains of the current
 * weekend (Saturday → sat+sun, Sunday → sunday only).
 */
export function upcomingWeekendRange(now: Date = new Date()): WeekendRange {
  const day = now.getDay(); // 0 = Sunday … 6 = Saturday
  if (day === 0) {
    const key = localDateKey(now);
    return { from: key, to: key };
  }
  const saturday = day === 6 ? now : nextSaturday(now);
  return {
    from: localDateKey(saturday),
    to: localDateKey(addDays(saturday, 1)),
  };
}
