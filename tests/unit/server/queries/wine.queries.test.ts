import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    booking: { findMany: vi.fn() },
    winery: { findUnique: vi.fn() },
    wine: { findMany: vi.fn() },
    emailLog: { count: vi.fn() },
  },
}));

const { db } = await import('@/server/db');
const { findEmptySheetSessions, findEmptySheetSessionsByWinery } =
  await import('@/server/queries/wine.queries');
const { zonedDateKey, zonedWallClockToUTC } =
  await import('@/lib/datetime/zurich');

/**
 * findEmptySheetSessions feeds both the 21h reminder (L-063) and the
 * dashboard alert banner: today's Zurich sessions that already ENDED
 * with ≥1 active booking and an empty tasting sheet.
 */
describe('findEmptySheetSessions', () => {
  // A "now" late enough that a 10:00 session (duration 60) has ended.
  const todayKey = zonedDateKey(new Date());
  const todayUTC = new Date(`${todayKey}T00:00:00.000Z`);
  const now = new Date(
    zonedWallClockToUTC(todayUTC, '18:00').getTime() + 60 * 60 * 1000
  );

  function bookingRow(
    overrides: Partial<{
      guestCount: number;
      timeSlot: string;
      experienceId: string;
      title: string;
      duration: number;
      wines: { id: string }[];
      wineryId: string;
    }> = {}
  ) {
    return {
      wineryId: overrides.wineryId ?? 'winery-1',
      guestCount: overrides.guestCount ?? 2,
      timeSlot: overrides.timeSlot ?? '10:00',
      experienceId: overrides.experienceId ?? 'exp-1',
      experience: {
        title: overrides.title ?? 'Dégustation',
        duration: overrides.duration ?? 60,
      },
      wines: overrides.wines ?? [],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('groups bookings per session and sums attendees', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      bookingRow({ guestCount: 2 }),
      bookingRow({ guestCount: 3 }),
      bookingRow({ timeSlot: '11:00', guestCount: 4 }),
    ] as never);

    const sessions = await findEmptySheetSessions({
      wineryId: 'winery-1',
      now,
    });
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      timeSlot: '10:00',
      attendeeCount: 5,
    });
    expect(sessions[1]).toMatchObject({ timeSlot: '11:00', attendeeCount: 4 });

    // Only active statuses are ever queried.
    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
          },
        }),
      })
    );
  });

  it('excludes a session whose sheet is already filled', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      bookingRow({ wines: [{ id: 'bw-1' }] }),
      bookingRow({ timeSlot: '11:00' }),
    ] as never);

    const sessions = await findEmptySheetSessions({
      wineryId: 'winery-1',
      now,
    });
    expect(sessions.map((s) => s.timeSlot)).toEqual(['11:00']);
  });

  it('a single filled booking marks the whole session as filled (D1 fan-out)', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      bookingRow({ wines: [] }),
      bookingRow({ wines: [{ id: 'bw-1' }] }),
    ] as never);

    const sessions = await findEmptySheetSessions({
      wineryId: 'winery-1',
      now,
    });
    expect(sessions).toHaveLength(0);
  });

  it('excludes sessions that have not ended yet', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      // 23:00 + 60min ends after our 19:00 "now".
      bookingRow({ timeSlot: '23:00' }),
      bookingRow({ timeSlot: '10:00' }),
    ] as never);

    const sessions = await findEmptySheetSessions({
      wineryId: 'winery-1',
      now,
    });
    expect(sessions.map((s) => s.timeSlot)).toEqual(['10:00']);
  });
  describe('findEmptySheetSessionsByWinery (one query for the 21h cron)', () => {
    it('buckets the ended, empty-sheet sessions per winery in a single read', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([
        bookingRow({ wineryId: 'winery-1', guestCount: 2 }),
        bookingRow({ wineryId: 'winery-1', guestCount: 1 }),
        bookingRow({
          wineryId: 'winery-2',
          experienceId: 'exp-2',
          timeSlot: '14:00',
          guestCount: 5,
        }),
        // winery-3: sheet already filled → no reminder.
        bookingRow({
          wineryId: 'winery-3',
          experienceId: 'exp-3',
          wines: [{ id: 'bw-1' }],
        }),
      ] as never);

      const byWinery = await findEmptySheetSessionsByWinery({
        wineryIds: ['winery-1', 'winery-2', 'winery-3', 'winery-4'],
        now,
      });

      expect(db.booking.findMany).toHaveBeenCalledTimes(1);
      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wineryId: {
              in: ['winery-1', 'winery-2', 'winery-3', 'winery-4'],
            },
          }),
        })
      );
      expect(Array.from(byWinery.keys()).sort()).toEqual([
        'winery-1',
        'winery-2',
      ]);
      expect(byWinery.get('winery-1')).toEqual([
        expect.objectContaining({ experienceId: 'exp-1', attendeeCount: 3 }),
      ]);
      expect(byWinery.get('winery-2')).toEqual([
        expect.objectContaining({ timeSlot: '14:00', attendeeCount: 5 }),
      ]);
    });

    it('does not query at all without wineries', async () => {
      const byWinery = await findEmptySheetSessionsByWinery({
        wineryIds: [],
        now,
      });

      expect(byWinery.size).toBe(0);
      expect(db.booking.findMany).not.toHaveBeenCalled();
    });
  });
});
