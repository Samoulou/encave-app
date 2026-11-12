import { describe, it, expect } from 'vitest';
import {
  formatEmailDate,
  formatEmailDateShort,
  formatEmailTime,
} from '@/emails/utils/formatters';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';

/**
 * The test process runs with TZ=UTC (tests/setup.ts), like the Vercel
 * runtime. Emails must still print the Europe/Zurich wall clock the guest
 * booked — never the UTC instant.
 */
describe('email date/time formatters (Europe/Zurich wall clock)', () => {
  it('prints the booked time in winter (CET, UTC+1)', () => {
    const start = zonedWallClockToUTC(
      new Date('2026-12-05T00:00:00Z'),
      '14:00'
    );
    expect(start.toISOString()).toBe('2026-12-05T13:00:00.000Z');
    expect(formatEmailTime(start, 'FR')).toBe('14:00');
    expect(formatEmailTime(start, 'DE')).toBe('14:00');
    expect(formatEmailTime(start, 'EN')).toBe('14:00');
  });

  it('prints the booked time in summer (CEST, UTC+2)', () => {
    const start = zonedWallClockToUTC(
      new Date('2026-07-18T00:00:00Z'),
      '10:30'
    );
    expect(start.toISOString()).toBe('2026-07-18T08:30:00.000Z');
    expect(formatEmailTime(start, 'FR')).toBe('10:30');
  });

  it('keeps the Zurich calendar day for a late-evening UTC instant', () => {
    // 23:30 UTC on the 4th is already 00:30 on the 5th in Zurich.
    const instant = new Date('2026-12-04T23:30:00Z');
    expect(formatEmailDate(instant, 'FR')).toContain('5 décembre 2026');
    expect(formatEmailDateShort(instant, 'FR')).toBe('5 décembre 2026');
  });

  it('keeps the stored calendar day for a date-only value (UTC midnight)', () => {
    const dateOnly = new Date('2026-12-05T00:00:00Z');
    expect(formatEmailDate(dateOnly, 'FR')).toContain('5 décembre 2026');
  });
});
