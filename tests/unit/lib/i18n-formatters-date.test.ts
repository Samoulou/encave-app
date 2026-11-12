import { describe, expect, it } from 'vitest';
import { localDateToUTC } from '@/lib/i18n/formatters';

describe('localDateToUTC', () => {
  it('returns UTC midnight of the local calendar day', () => {
    const local = new Date(2026, 10, 16, 23, 45, 12);
    const result = localDateToUTC(local);

    expect(result.toISOString()).toBe('2026-11-16T00:00:00.000Z');
  });

  it('is idempotent on a date-only (UTC midnight) value under TZ=UTC', () => {
    const dbDate = new Date('2026-03-29T00:00:00.000Z');

    expect(localDateToUTC(dbDate).getTime()).toBe(dbDate.getTime());
  });

  it('does not mutate its argument', () => {
    const input = new Date(2026, 0, 31, 12);
    const before = input.getTime();
    localDateToUTC(input);

    expect(input.getTime()).toBe(before);
  });
});
