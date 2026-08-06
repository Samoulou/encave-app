import { describe, it, expect } from 'vitest';
import {
  expandRecurringDates,
  normalizePunctualDates,
  zurichTodayAsUTCDate,
  utcDateFromKey,
  dateKeyOf,
} from '@/lib/business-rules/occurrence-expansion';

const d = utcDateFromKey;

describe('occurrence-expansion (P-05 / L-024)', () => {
  describe('expandRecurringDates', () => {
    it('US-101: sat 10h/16h over 6 weeks yields exactly 12 occurrences', () => {
      // 2026-07-13 is a Monday; the window [mon, mon+42) holds 6 Saturdays.
      const result = expandRecurringDates({
        slots: [
          { dayOfWeek: 6, startTime: '10:00', isActive: true },
          { dayOfWeek: 6, startTime: '16:00', isActive: true },
        ],
        from: d('2026-07-13'),
        horizonDays: 42,
      });

      expect(result).toHaveLength(12);
      // Sorted by date then time, first Saturday in window is 2026-07-18.
      expect(dateKeyOf(result[0]!.date)).toBe('2026-07-18');
      expect(result[0]!.startTime).toBe('10:00');
      expect(result[1]!.startTime).toBe('16:00');
      expect(dateKeyOf(result[11]!.date)).toBe('2026-08-22');
    });

    it('skips inactive slots entirely', () => {
      const result = expandRecurringDates({
        slots: [
          { dayOfWeek: 6, startTime: '10:00', isActive: true },
          { dayOfWeek: 6, startTime: '16:00', isActive: false },
        ],
        from: d('2026-07-13'),
        horizonDays: 42,
      });
      expect(result).toHaveLength(6);
      expect(result.every((o) => o.startTime === '10:00')).toBe(true);
    });

    it('skips blacked-out dates without shifting the rest', () => {
      const result = expandRecurringDates({
        slots: [{ dayOfWeek: 6, startTime: '10:00', isActive: true }],
        blackoutDates: [d('2026-07-25')],
        from: d('2026-07-13'),
        horizonDays: 42,
      });
      expect(result).toHaveLength(5);
      expect(result.map((o) => dateKeyOf(o.date))).not.toContain('2026-07-25');
      expect(result.map((o) => dateKeyOf(o.date))).toContain('2026-07-18');
      expect(result.map((o) => dateKeyOf(o.date))).toContain('2026-08-01');
    });

    it('window start is inclusive: a slot on the from-day is generated', () => {
      // 2026-07-18 is a Saturday.
      const result = expandRecurringDates({
        slots: [{ dayOfWeek: 6, startTime: '10:00', isActive: true }],
        from: d('2026-07-18'),
        horizonDays: 1,
      });
      expect(result).toHaveLength(1);
      expect(dateKeyOf(result[0]!.date)).toBe('2026-07-18');
    });

    it('dedups identical (day, startTime) pairs across duplicate slots', () => {
      const result = expandRecurringDates({
        slots: [
          { dayOfWeek: 6, startTime: '10:00', isActive: true },
          { dayOfWeek: 6, startTime: '10:00', isActive: true },
        ],
        from: d('2026-07-13'),
        horizonDays: 7,
      });
      expect(result).toHaveLength(1);
    });

    it('crosses the October DST fall-back without dropping or doubling a date', () => {
      // Europe/Zurich leaves DST on 2026-10-25 (a Sunday). Calendar-date
      // expansion must be immune: one occurrence per Sunday, incl. the
      // switch day itself.
      const result = expandRecurringDates({
        slots: [{ dayOfWeek: 0, startTime: '10:00', isActive: true }],
        from: d('2026-10-19'), // Monday before the switch
        horizonDays: 14,
      });
      expect(result.map((o) => dateKeyOf(o.date))).toEqual([
        '2026-10-25',
        '2026-11-01',
      ]);
    });

    it('returns [] for an empty horizon or no active slots', () => {
      expect(
        expandRecurringDates({
          slots: [{ dayOfWeek: 6, startTime: '10:00', isActive: true }],
          from: d('2026-07-13'),
          horizonDays: 0,
        })
      ).toEqual([]);
      expect(
        expandRecurringDates({
          slots: [{ dayOfWeek: 6, startTime: '10:00', isActive: false }],
          from: d('2026-07-13'),
          horizonDays: 42,
        })
      ).toEqual([]);
    });
  });

  describe('normalizePunctualDates', () => {
    it('sorts, dedups and drops picks before the window start', () => {
      const result = normalizePunctualDates({
        picks: [
          { date: d('2026-08-02'), startTime: '16:00' },
          { date: d('2026-08-01'), startTime: '10:00' },
          { date: d('2026-08-01'), startTime: '10:00' }, // dup
          { date: d('2026-07-01'), startTime: '10:00' }, // past
        ],
        from: d('2026-07-13'),
      });
      expect(result).toEqual([
        { date: d('2026-08-01'), startTime: '10:00' },
        { date: d('2026-08-02'), startTime: '16:00' },
      ]);
    });
  });

  describe('zurichTodayAsUTCDate', () => {
    it('at 23:30 UTC, Zurich is already on the next calendar day (summer)', () => {
      // 2026-07-09T23:30Z = 2026-07-10 01:30 in Zurich (CEST).
      const today = zurichTodayAsUTCDate(new Date('2026-07-09T23:30:00Z'));
      expect(dateKeyOf(today)).toBe('2026-07-10');
    });

    it('at 12:00 UTC, Zurich and UTC agree on the calendar day', () => {
      const today = zurichTodayAsUTCDate(new Date('2026-07-09T12:00:00Z'));
      expect(dateKeyOf(today)).toBe('2026-07-09');
    });

    it('in winter (CET, UTC+1) the boundary is 23:00 UTC', () => {
      const today = zurichTodayAsUTCDate(new Date('2026-12-01T23:15:00Z'));
      expect(dateKeyOf(today)).toBe('2026-12-02');
    });
  });
});
