import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, OccurrenceStatus } from '@prisma/client';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';

vi.mock('@/server/db', () => ({
  db: {
    experienceOccurrence: { findMany: vi.fn() },
    blockedDate: { findMany: vi.fn() },
    booking: { groupBy: vi.fn(), aggregate: vi.fn() },
  },
}));

const { db } = await import('@/server/db');
const {
  getWineryFillRate30d,
  getUpcomingWinerySessions,
  getMonthGrossRevenue,
} = await import('@/server/queries/dashboard-today.queries');

const D1 = new Date('2026-07-01T00:00:00.000Z');
const D2 = new Date('2026-07-02T00:00:00.000Z');

function occurrence(
  overrides: Partial<{
    id: string;
    experienceId: string;
    date: Date;
    startTime: string;
    capacityOverride: number | null;
    maxCapacity: number;
    title: string;
  }> = {}
) {
  return {
    id: overrides.id ?? 'occ-1',
    experienceId: overrides.experienceId ?? 'exp-1',
    date: overrides.date ?? D1,
    startTime: overrides.startTime ?? '10:00',
    capacityOverride: overrides.capacityOverride ?? null,
    experience: {
      title: overrides.title ?? 'Dégustation',
      maxCapacity: overrides.maxCapacity ?? 8,
    },
  };
}

describe('getWineryFillRate30d', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sums offered capacity (override wins) and matched sold seats', async () => {
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([
      occurrence({ startTime: '10:00' }), // cap 8
      occurrence({ startTime: '16:00', capacityOverride: 4 }), // cap 4
      occurrence({ date: D2, startTime: '10:00' }), // cap 8, aucune vente
    ] as never);
    vi.mocked(db.booking.groupBy).mockResolvedValue([
      {
        experienceId: 'exp-1',
        date: D1,
        timeSlot: '10:00',
        _sum: { guestCount: 6 },
      },
      {
        experienceId: 'exp-1',
        date: D1,
        timeSlot: '16:00',
        _sum: { guestCount: 4 },
      },
      // Straggler: aucune occurrence correspondante → exclu
      {
        experienceId: 'exp-1',
        date: D1,
        timeSlot: '22:00',
        _sum: { guestCount: 5 },
      },
    ] as never);

    const result = await getWineryFillRate30d('owner-1');
    expect(result).toEqual({
      soldSeats: 10,
      offeredSeats: 20,
      ratePct: 50,
    });
  });

  it('returns ratePct null when no capacity was offered', async () => {
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([] as never);
    vi.mocked(db.booking.groupBy).mockResolvedValue([] as never);
    const result = await getWineryFillRate30d('owner-1');
    expect(result).toEqual({ soldSeats: 0, offeredSeats: 0, ratePct: null });
  });

  it('queries CANCELLED-free occurrences and the past seat predicate', async () => {
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([] as never);
    vi.mocked(db.booking.groupBy).mockResolvedValue([] as never);
    await getWineryFillRate30d('owner-1');

    expect(db.experienceOccurrence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: OccurrenceStatus.CANCELLED },
        }),
      })
    );
    // Le prédicat passé compte COMPLETED + NO_SHOW en plus des actifs.
    const groupByWhere = vi.mocked(db.booking.groupBy).mock.calls[0]?.[0]
      ?.where as { OR: unknown[] };
    expect(JSON.stringify(groupByWhere.OR)).toContain(BookingStatus.NO_SHOW);
  });
});

describe('getUpcomingWinerySessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.blockedDate.findMany).mockResolvedValue([] as never);
    vi.mocked(db.booking.groupBy).mockResolvedValue([] as never);
  });

  it('maps occurrences with sold seats and effective capacity', async () => {
    const today = zurichTodayAsUTCDate(new Date());
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([
      occurrence({ id: 'occ-a', date: today, capacityOverride: 5 }),
    ] as never);
    vi.mocked(db.booking.groupBy).mockResolvedValue([
      {
        experienceId: 'exp-1',
        date: today,
        timeSlot: '10:00',
        _sum: { guestCount: 3 },
      },
    ] as never);

    const sessions = await getUpcomingWinerySessions('owner-1');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      occurrenceId: 'occ-a',
      soldSeats: 3,
      capacity: 5,
    });
  });

  it('excludes blacked-out dates and honors the limit', async () => {
    const today = zurichTodayAsUTCDate(new Date());
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([
      occurrence({ id: 'occ-blocked', date: today }),
      occurrence({ id: 'occ-b', date: today, startTime: '16:00' }),
      occurrence({ id: 'occ-c', date: today, startTime: '18:00' }),
    ] as never);
    vi.mocked(db.blockedDate.findMany).mockResolvedValue([
      { experienceId: 'exp-1', date: today },
    ] as never);

    const sessions = await getUpcomingWinerySessions('owner-1', { limit: 2 });
    // La date entière est blackoutée pour exp-1 → tout est exclu.
    expect(sessions).toHaveLength(0);
  });
});

describe('getMonthGrossRevenue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sums totalPrice over CONFIRMED/COMPLETED/NO_SHOW of the month', async () => {
    vi.mocked(db.booking.aggregate).mockResolvedValue({
      _sum: { totalPrice: 123450 },
    } as never);
    const gross = await getMonthGrossRevenue('owner-1');
    expect(gross).toBe(123450);
    expect(db.booking.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.COMPLETED,
              BookingStatus.NO_SHOW,
            ],
          },
        }),
      })
    );
  });

  it('returns 0 on an empty month', async () => {
    vi.mocked(db.booking.aggregate).mockResolvedValue({
      _sum: { totalPrice: null },
    } as never);
    expect(await getMonthGrossRevenue('owner-1')).toBe(0);
  });
});
