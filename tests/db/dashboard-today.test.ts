/**
 * P-13 « Aujourd'hui » — against a REAL migrated database.
 * Covers the 30-day fill rate (override counted, COMPLETED+NO_SHOW sold,
 * empty occurrence in the denominator, CANCELLED excluded, straggler
 * ignored) and the upcoming winery sessions gauges.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npm run test:db:invariants
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient, BookingStatus, OccurrenceStatus } from '@prisma/client';
import { addDays } from 'date-fns';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': `198.51.100.${(process.pid + 9) % 250}` }),
}));

type TodayQueries = typeof import('@/server/queries/dashboard-today.queries');
type ScanQueries = typeof import('@/server/queries/scan.queries');

describe.skipIf(!url)("dashboard Aujourd'hui (P-13 / L-130)", () => {
  let db: PrismaClient;
  let getWineryFillRate30d: TodayQueries['getWineryFillRate30d'];
  let getUpcomingWinerySessions: TodayQueries['getUpcomingWinerySessions'];
  let getScanDayList: ScanQueries['getScanDayList'];
  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};

  const today = zurichTodayAsUTCDate(new Date());
  const past = addDays(today, -5);
  const future = addDays(today, 2);

  function makeBooking(
    status: BookingStatus,
    guestCount: number,
    date: Date,
    timeSlot: string
  ) {
    if (!ids.experienceId || !ids.wineryId) throw new Error('fixture missing');
    return db.booking.create({
      data: {
        reference: `ENC-TD${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        visitorEmail: `today-${Math.random().toString(36).slice(2, 8)}@test.encave.ch`,
        visitorName: 'Client Today',
        visitorPhone: '+41790000010',
        experienceId: ids.experienceId,
        wineryId: ids.wineryId,
        date,
        timeSlot,
        guestCount,
        totalPrice: guestCount * 2500,
        platformFee: guestCount * 300,
        wineryPayout: guestCount * 2200,
        status,
      },
    });
  }

  function makeOccurrence(
    date: Date,
    startTime: string,
    options: {
      status?: OccurrenceStatus;
      capacityOverride?: number | null;
    } = {}
  ) {
    if (!ids.experienceId) throw new Error('fixture missing');
    return db.experienceOccurrence.create({
      data: {
        experienceId: ids.experienceId,
        date,
        startTime,
        status: options.status ?? OccurrenceStatus.OPEN,
        capacityOverride: options.capacityOverride ?? null,
        source: 'PUNCTUAL',
      },
    });
  }

  beforeAll(async () => {
    ({ getWineryFillRate30d, getUpcomingWinerySessions } =
      await import('@/server/queries/dashboard-today.queries'));
    ({ getScanDayList } = await import('@/server/queries/scan.queries'));
    db = new PrismaClient({ datasourceUrl: url });
    const user = await db.user.create({
      data: {
        email: `today-${Date.now()}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Today Winery ${Date.now()}`,
        slug: `today-${Date.now()}`,
        description: 'Today test fixture',
        address: 'Route du Test 13',
        commune: 'Sion',
        phone: '+41270000013',
        email: 'today@test.encave.ch',
        userId: user.id,
        status: 'VERIFIED',
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Today Experience',
        slug: `today-${Date.now()}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 90,
        price: 2500,
        minCapacity: 1,
        maxCapacity: 8,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'PUBLISHED',
      },
    });
    ids.experienceId = experience.id;

    // Past window: occ A (cap 8) sold 6 (COMPLETED 4 + NO_SHOW 2, plus a
    // cancelled 3 that must NOT count) ; occ B (override 4) empty ;
    // occ C CANCELLED (capacity excluded) ; straggler booking at 22:00
    // without occurrence (excluded).
    await makeOccurrence(past, '10:00');
    await makeOccurrence(past, '16:00', { capacityOverride: 4 });
    await makeOccurrence(past, '18:00', { status: OccurrenceStatus.CANCELLED });
    await makeBooking(BookingStatus.COMPLETED, 4, past, '10:00');
    await makeBooking(BookingStatus.NO_SHOW, 2, past, '10:00');
    await makeBooking(BookingStatus.CANCELLED_BY_CLIENT, 3, past, '10:00');
    await makeBooking(BookingStatus.COMPLETED, 5, past, '22:00');

    // Future: one OPEN occurrence with 3 CONFIRMED seats.
    await makeOccurrence(future, '10:00');
    await makeBooking(BookingStatus.CONFIRMED, 3, future, '10:00');

    // TODAY (scan day list): one CONFIRMED with a token hash, one
    // COMPLETED (already scanned), one CANCELLED and one hash-less
    // CONFIRMED — the last two must never reach the scan list.
    const scannable = await makeBooking(
      BookingStatus.CONFIRMED,
      2,
      today,
      '11:00'
    );
    await db.booking.update({
      where: { id: scannable.id },
      data: { accessTokenHash: 'a'.repeat(64) },
    });
    const scanned = await makeBooking(
      BookingStatus.COMPLETED,
      3,
      today,
      '11:00'
    );
    await db.booking.update({
      where: { id: scanned.id },
      data: { accessTokenHash: 'b'.repeat(64), checkedInAt: new Date() },
    });
    await makeBooking(BookingStatus.CANCELLED_BY_CLIENT, 2, today, '11:00');
    await makeBooking(BookingStatus.CONFIRMED, 1, today, '11:00'); // no hash
  });

  afterAll(async () => {
    if (ids.wineryId) {
      await db.booking
        .deleteMany({ where: { wineryId: ids.wineryId } })
        .catch(() => {});
    }
    if (ids.userId) {
      await db.user.delete({ where: { id: ids.userId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  it('30-day fill rate: override + empty occurrence in denominator, CANCELLED and stragglers out', async () => {
    if (!ids.userId) throw new Error('fixture');
    const result = await getWineryFillRate30d(ids.userId);
    // offered = 8 (occ A) + 4 (occ B override) ; CANCELLED excluded.
    // sold = 4 COMPLETED + 2 NO_SHOW ; cancelled booking and the 22:00
    // straggler never count.
    expect(result).toEqual({ soldSeats: 6, offeredSeats: 12, ratePct: 50 });
  });

  it('upcoming sessions carry sold seats and effective capacity', async () => {
    if (!ids.userId) throw new Error('fixture');
    const sessions = await getUpcomingWinerySessions(ids.userId);
    const target = sessions.find(
      (session) => session.date.getTime() === future.getTime()
    );
    expect(target).toMatchObject({
      experienceTitle: 'Today Experience',
      startTime: '10:00',
      soldSeats: 3,
      capacity: 8,
    });
  });

  it("scan day list: only today's active bookings, hashes present (P-13 / L-140)", async () => {
    if (!ids.userId) throw new Error('fixture');
    const list = await getScanDayList(ids.userId);
    expect(list).not.toBeNull();
    const todays = (list ?? []).filter((entry) => entry.timeSlot === '11:00');

    // CANCELLED and hash-less bookings are out; both actives are in.
    expect(todays).toHaveLength(2);
    const confirmed = todays.find((entry) => entry.status === 'CONFIRMED');
    const completed = todays.find((entry) => entry.status === 'COMPLETED');
    expect(confirmed).toMatchObject({
      accessTokenHash: 'a'.repeat(64),
      guestCount: 2,
      experienceTitle: 'Today Experience',
      checkedInAtMs: null,
    });
    expect(completed?.accessTokenHash).toBe('b'.repeat(64));
    expect(completed?.checkedInAtMs).toBeTypeOf('number');
  });
});
