/**
 * Shared Europe/Zurich datetime helpers (P-05 / ADR-0002).
 *
 * Extracted from event-detail.queries.ts so occurrence generation, the
 * owner calendar and the date search all share ONE wall-clock → instant
 * conversion. Sessions/occurrences store a calendar date (`@db.Date`,
 * UTC midnight) + a Zurich wall-clock "HH:mm"; only these helpers may
 * turn that pair into a real instant.
 */

import { parseTimeSlot } from '@/lib/validators/booking';

export const SESSION_TIMEZONE = 'Europe/Zurich';

/**
 * Compute the UTC instant for a given local (Europe/Zurich) wall-clock
 * formed by `date` (date-only, UTC midnight) at `HH:mm`.
 *
 * Implementation: take the wall-clock interpreted as UTC, then ask the
 * runtime what that instant looks like in Europe/Zurich, derive the
 * offset, and shift. Handles CET (+01:00) / CEST (+02:00) without
 * pulling in date-fns-tz.
 */
export function zonedWallClockToUTC(date: Date, timeSlot: string): Date {
  const { hours, minutes } = parseTimeSlot(timeSlot);
  const wallUTC = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      0,
      0
    )
  );

  // Get the Europe/Zurich representation of wallUTC, parse the components.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SESSION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    // Force 00–23 ('en-CA' otherwise lets midnight surface as '24:00:00').
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(wallUTC);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  }
  const zoneAsUTC = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour === '24' ? '0' : lookup.hour),
    Number(lookup.minute),
    Number(lookup.second)
  );
  const offsetMs = zoneAsUTC - wallUTC.getTime();
  return new Date(wallUTC.getTime() - offsetMs);
}

/**
 * Get the local (Europe/Zurich) date "YYYY-MM-DD" for an instant.
 */
export function zonedDateKey(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SESSION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

/**
 * Local (Europe/Zurich) hour of day (0-23) for an instant. Used by the
 * 21h tasting-sheet reminder guard: the cron fires at two UTC hours
 * (19 & 20) and only the run matching 21h local acts — DST-proof.
 */
export function zonedHourOf(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SESSION_TIMEZONE,
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
  const hour = fmt.formatToParts(date).find((p) => p.type === 'hour')?.value;
  return hour === undefined || hour === '24' ? 0 : Number(hour);
}
