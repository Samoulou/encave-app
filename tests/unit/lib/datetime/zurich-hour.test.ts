import { describe, expect, it } from 'vitest';
import { zonedHourOf } from '@/lib/datetime/zurich';

/**
 * The 21h reminder guard (P-07 / L-063): the cron fires at 19:00 AND
 * 20:00 UTC — exactly one of them is 21:00 in Europe/Zurich, whatever
 * the season.
 */
describe('zonedHourOf (Europe/Zurich)', () => {
  it('winter (CET, UTC+1): 20:00 UTC is 21h local, 19:00 UTC is not', () => {
    expect(zonedHourOf(new Date('2026-01-15T20:00:00.000Z'))).toBe(21);
    expect(zonedHourOf(new Date('2026-01-15T19:00:00.000Z'))).toBe(20);
  });

  it('summer (CEST, UTC+2): 19:00 UTC is 21h local, 20:00 UTC is not', () => {
    expect(zonedHourOf(new Date('2026-07-15T19:00:00.000Z'))).toBe(21);
    expect(zonedHourOf(new Date('2026-07-15T20:00:00.000Z'))).toBe(22);
  });

  it('exactly one of the two UTC schedules matches, every day of the year', () => {
    for (let month = 0; month < 12; month++) {
      const day = new Date(Date.UTC(2026, month, 10));
      const at19 = zonedHourOf(
        new Date(Date.UTC(2026, month, day.getUTCDate(), 19))
      );
      const at20 = zonedHourOf(
        new Date(Date.UTC(2026, month, day.getUTCDate(), 20))
      );
      const matches = [at19, at20].filter((hour) => hour === 21);
      expect(matches).toHaveLength(1);
    }
  });

  it('handles midnight without the h24 quirk', () => {
    expect(zonedHourOf(new Date('2026-01-15T23:00:00.000Z'))).toBe(0);
  });
});
