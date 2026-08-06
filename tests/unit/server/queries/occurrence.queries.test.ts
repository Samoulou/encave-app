import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus, OccurrenceStatus } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    experience: { findFirst: vi.fn(), findUnique: vi.fn() },
    experienceOccurrence: { findMany: vi.fn() },
    booking: { findMany: vi.fn(), groupBy: vi.fn() },
    blockedDate: { findMany: vi.fn() },
    // P-07: the calendar also loads the month's tasting sheets.
    bookingWine: { findMany: vi.fn() },
  },
}));

const { db } = await import('@/server/db');
const { getOccurrenceCalendar } =
  await import('@/server/queries/occurrence.queries');

const D1 = new Date('2026-08-01T00:00:00.000Z');
const D2 = new Date('2026-08-02T00:00:00.000Z');

function booking(
  overrides: Partial<{
    id: string;
    reference: string;
    visitorName: string;
    guestCount: number;
    status: BookingStatus;
    date: Date;
    timeSlot: string;
    expiresAt: Date | null;
  }>
) {
  return {
    id: 'b-default',
    reference: 'ENC-XXXXXXXX',
    visitorName: 'Client Test',
    visitorEmail: 'client@test.encave.ch',
    checkedInAt: null,
    guestCount: 1,
    status: BookingStatus.CONFIRMED,
    date: D1,
    timeSlot: '10:00',
    expiresAt: null,
    // P-07: the calendar read piggybacks the tasting sheet on the booking.
    wines: [],
    ...overrides,
  };
}

describe('getOccurrenceCalendar (P-05 / L-132)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.experience.findFirst).mockResolvedValue({
      id: 'exp-1',
      title: 'Dégustation',
      maxCapacity: 8,
    } as never);
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([
      {
        id: 'occ-1',
        date: D1,
        startTime: '10:00',
        status: OccurrenceStatus.OPEN,
        capacityOverride: null,
      },
    ] as never);
    vi.mocked(db.blockedDate.findMany).mockResolvedValue([] as never);
    vi.mocked(db.bookingWine.findMany).mockResolvedValue([] as never);
  });

  it('lists cancelled bookings as attendees WITHOUT counting their seats', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      booking({ id: 'b-confirmed', guestCount: 2 }),
      booking({
        id: 'b-cancelled',
        guestCount: 3,
        status: BookingStatus.CANCELLED_BY_CLIENT,
      }),
      booking({
        id: 'b-hold',
        guestCount: 1,
        status: BookingStatus.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }),
    ] as never);

    const calendar = await getOccurrenceCalendar('exp-1', 'user-1', '2026-08');
    expect(calendar).not.toBeNull();
    const entry = calendar?.entries[0];
    // Seats: confirmed 2 + live hold 1. The cancellation NEVER counts.
    expect(entry?.bookedCount).toBe(3);
    // Attendees: confirmed + cancelled (who-cancelled context), the
    // anonymous live hold stays invisible.
    expect(entry?.attendees.map((a) => a.bookingId)).toEqual([
      'b-confirmed',
      'b-cancelled',
    ]);
    expect(
      entry?.attendees.find((a) => a.bookingId === 'b-cancelled')?.status
    ).toBe(BookingStatus.CANCELLED_BY_CLIENT);
  });

  it('requests cancelled statuses from the DB (regression: they were filtered out)', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([] as never);
    await getOccurrenceCalendar('exp-1', 'user-1', '2026-08');
    const args = vi.mocked(db.booking.findMany).mock.calls[0]?.[0];
    const statuses =
      (args?.where?.status as { in?: BookingStatus[] } | undefined)?.in ?? [];
    expect(statuses).toContain(BookingStatus.CANCELLED_BY_CLIENT);
    expect(statuses).toContain(BookingStatus.CANCELLED_BY_WINERY);
  });

  it('an expired hold neither counts nor appears', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      booking({
        id: 'b-stale-hold',
        guestCount: 4,
        status: BookingStatus.PENDING_PAYMENT,
        expiresAt: new Date(Date.now() - 60 * 1000),
      }),
    ] as never);

    const calendar = await getOccurrenceCalendar('exp-1', 'user-1', '2026-08');
    const entry = calendar?.entries[0];
    expect(entry?.bookedCount).toBe(0);
    expect(entry?.attendees).toEqual([]);
  });

  it('groups a cancelled straggler (no occurrence row) as its own entry', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      booking({
        id: 'b-straggler',
        date: D2,
        timeSlot: '14:00',
        status: BookingStatus.CANCELLED_BY_WINERY,
        guestCount: 2,
      }),
    ] as never);

    const calendar = await getOccurrenceCalendar('exp-1', 'user-1', '2026-08');
    expect(calendar?.entries).toHaveLength(2);
    const straggler = calendar?.entries.find((e) => e.startTime === '14:00');
    expect(straggler?.occurrenceId).toBeNull();
    expect(straggler?.bookedCount).toBe(0);
    expect(straggler?.attendees.map((a) => a.bookingId)).toEqual([
      'b-straggler',
    ]);
  });
});
