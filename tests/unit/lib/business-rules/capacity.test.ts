import { describe, it, expect } from 'vitest';
import { BookingStatus } from '@prisma/client';
import {
  activeCapacityBookingWhere,
  isActiveCapacityBooking,
  isSlotStartInFuture,
} from '@/lib/business-rules/capacity';

const NOW = new Date('2026-07-15T08:00:00.000Z');
const LATER = new Date('2026-07-15T09:00:00.000Z');
const EARLIER = new Date('2026-07-15T07:00:00.000Z');

describe('seat-holding predicate (activeCapacityBookingWhere + JS twin)', () => {
  it('counts CONFIRMED, COMPLETED and NO_SHOW always, PENDING_PAYMENT only while alive', () => {
    expect(activeCapacityBookingWhere(NOW)).toEqual({
      OR: [
        {
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.COMPLETED,
              BookingStatus.NO_SHOW,
            ],
          },
        },
        { status: BookingStatus.PENDING_PAYMENT, expiresAt: { gt: NOW } },
      ],
    });
  });

  // The JS twin must answer exactly like the SQL predicate, status by status.
  it.each([
    [BookingStatus.CONFIRMED, null, true],
    // A scanned ticket is a guest IN the seat — never resellable.
    [BookingStatus.COMPLETED, null, true],
    // A no-show's seat was sold (and may be charged a fee).
    [BookingStatus.NO_SHOW, null, true],
    [BookingStatus.PENDING_PAYMENT, LATER, true],
    [BookingStatus.PENDING_PAYMENT, EARLIER, false],
    [BookingStatus.PENDING_PAYMENT, null, false],
    [BookingStatus.CANCELLED_BY_CLIENT, null, false],
    [BookingStatus.CANCELLED_BY_WINERY, null, false],
  ])('%s (expiresAt %s) holds a seat: %s', (status, expiresAt, expected) => {
    expect(isActiveCapacityBooking({ status, expiresAt }, NOW)).toBe(expected);
  });
});

describe('isSlotStartInFuture (Europe/Zurich wall clock)', () => {
  const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

  it('summer (CEST, UTC+2): 10:00 Zurich is 08:00 UTC', () => {
    const date = day('2026-07-15');
    expect(
      isSlotStartInFuture(date, '10:00', new Date('2026-07-15T07:59:59.000Z'))
    ).toBe(true);
    // Strictly in the future: the start instant itself is too late.
    expect(
      isSlotStartInFuture(date, '10:00', new Date('2026-07-15T08:00:00.000Z'))
    ).toBe(false);
    expect(
      isSlotStartInFuture(date, '10:00', new Date('2026-07-15T12:00:00.000Z'))
    ).toBe(false);
  });

  it('winter (CET, UTC+1): 10:00 Zurich is 09:00 UTC', () => {
    const date = day('2026-12-15');
    expect(
      isSlotStartInFuture(date, '10:00', new Date('2026-12-15T08:59:59.000Z'))
    ).toBe(true);
    expect(
      isSlotStartInFuture(date, '10:00', new Date('2026-12-15T09:00:00.000Z'))
    ).toBe(false);
  });

  it('a later slot of the same day stays bookable; any slot of a past day does not', () => {
    const now = new Date('2026-07-15T10:00:00.000Z'); // 12:00 Zurich
    expect(isSlotStartInFuture(day('2026-07-15'), '14:00', now)).toBe(true);
    expect(isSlotStartInFuture(day('2026-07-14'), '23:00', now)).toBe(false);
    expect(isSlotStartInFuture(day('2026-07-16'), '00:00', now)).toBe(true);
  });

  it('an unparsable date is never bookable (and never throws)', () => {
    expect(isSlotStartInFuture(new Date('not-a-date'), '10:00', NOW)).toBe(
      false
    );
  });
});
