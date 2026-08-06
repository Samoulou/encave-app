/**
 * Pure date-expansion for occurrence generation (P-05 / L-024).
 *
 * Works entirely in "calendar date" space: dates are UTC-midnight Date
 * objects (the `@db.Date` convention used by Booking/ExperienceOccurrence)
 * and `startTime` is an Europe/Zurich wall-clock "HH:mm" string. DST never
 * shifts a calendar date, so the expansion needs no timezone math — only
 * the *instant* conversion does (zonedWallClockToUTC, event-detail), and
 * that stays out of this module. The one timezone-sensitive input is
 * "today", which callers must derive in Europe/Zurich (see
 * `zurichTodayAsUTCDate`).
 *
 * Pure module — no I/O, no Prisma; fully unit-testable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecurringSlotInput {
  /** JS getDay() convention: 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** Europe/Zurich wall-clock "HH:mm". */
  startTime: string;
  isActive: boolean;
}

export interface ExpandedOccurrence {
  /** UTC-midnight calendar date (`@db.Date` convention). */
  date: Date;
  /** Europe/Zurich wall-clock "HH:mm". */
  startTime: string;
}

/** UTC-midnight Date for a YYYY-MM-DD key. */
export function utcDateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** YYYY-MM-DD key of a UTC-midnight Date. */
export function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Today's calendar date in Europe/Zurich, as a UTC-midnight Date.
 * At 00:30 Zurich (23:30 UTC the previous day) the UTC calendar is one
 * day behind — deriving "today" from the server's UTC clock would
 * generate/expire occurrences a day off around midnight.
 */
export function zurichTodayAsUTCDate(now: Date = new Date()): Date {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return utcDateFromKey(key);
}

/**
 * Expand active weekly slots into concrete (date, startTime) pairs over
 * [from, from + horizonDays), skipping blacked-out dates. Results are
 * sorted by date then startTime and deduplicated on the
 * (date, startTime) key — the same uniqueness the DB enforces.
 */
export function expandRecurringDates(input: {
  slots: readonly RecurringSlotInput[];
  /** UTC-midnight dates (BlockedDate convention). */
  blackoutDates?: readonly Date[];
  /** UTC-midnight start of the window (inclusive) — Zurich "today". */
  from: Date;
  horizonDays: number;
}): ExpandedOccurrence[] {
  const { slots, blackoutDates = [], from, horizonDays } = input;

  const startTimesByDay = new Map<number, Set<string>>();
  for (const slot of slots) {
    if (!slot.isActive) continue;
    const set = startTimesByDay.get(slot.dayOfWeek) ?? new Set<string>();
    set.add(slot.startTime);
    startTimesByDay.set(slot.dayOfWeek, set);
  }
  if (startTimesByDay.size === 0 || horizonDays <= 0) return [];

  const blackoutKeys = new Set(blackoutDates.map(dateKeyOf));

  const out: ExpandedOccurrence[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const date = new Date(from.getTime() + i * DAY_MS);
    // UTC-midnight dates: getUTCDay is the calendar weekday, immune to
    // the server's local timezone.
    const startTimes = startTimesByDay.get(date.getUTCDay());
    if (!startTimes) continue;
    if (blackoutKeys.has(dateKeyOf(date))) continue;
    for (const startTime of Array.from(startTimes).sort()) {
      out.push({ date, startTime });
    }
  }
  return out;
}

/**
 * Normalize punctual picks (chips UI) into the same shape: dedup on
 * (date, startTime), drop dates before `from`, sort. Validation of the
 * HH:mm format belongs to the Zod layer, not here.
 */
export function normalizePunctualDates(input: {
  picks: readonly { date: Date; startTime: string }[];
  from: Date;
}): ExpandedOccurrence[] {
  const { picks, from } = input;
  const seen = new Set<string>();
  const out: ExpandedOccurrence[] = [];
  for (const pick of [...picks].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.startTime.localeCompare(b.startTime)
  )) {
    if (pick.date.getTime() < from.getTime()) continue;
    const key = `${dateKeyOf(pick.date)}|${pick.startTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date: pick.date, startTime: pick.startTime });
  }
  return out;
}
