/**
 * Quality lot (audit A7) — soonest BOOKABLE occurrence per experience,
 * against a REAL migrated database.
 *
 * `mapNextBookableOccurrences` now picks the soonest open, non-blacked-out
 * occurrence of each experience in SQL (LATERAL top-1) instead of loading
 * the whole 92-day window. This suite proves the raw SQL (table / column /
 * enum names, DATE comparison, NOT EXISTS blocked_dates) and its parity
 * with the exhaustive reference scan on every edge the booking path knows:
 * closed / cancelled occurrence, blackout, sold-out slot (plain and
 * override), expired hold, cancelled booking, window bounds, empty window.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npm run test:db:invariants
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient, BookingStatus, OccurrenceStatus } from '@prisma/client';
import { addDays } from 'date-fns';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({
      'x-forwarded-for': `198.51.100.${(process.pid + 31) % 250}`,
    }),
}));

type ExperienceQueries = typeof import('@/server/queries/experience.queries');

describe.skipIf(!url)('next bookable occurrence per experience (A7)', () => {
  let db: PrismaClient;
  let mapNextBookableOccurrences: ExperienceQueries['mapNextBookableOccurrences'];
  let scanNextBookableOccurrences: ExperienceQueries['scanNextBookableOccurrences'];

  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ids: { userId?: string; wineryId?: string } = {};
  const exp: Record<string, string> = {};

  // Far-future, fixed calendar days: independent of "today" and of the
  // session time zone (they are DATE values, compared as dates).
  const d0 = new Date('2099-03-02T00:00:00.000Z');
  const day = (offset: number) => addDays(d0, offset);
  const now = new Date();

  async function makeExperience(key: string, maxCapacity = 8) {
    if (!ids.wineryId) throw new Error('fixture missing');
    const experience = await db.experience.create({
      data: {
        wineryId: ids.wineryId,
        title: `A7 ${key}`,
        slug: `a7-${key}-${run}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 90,
        price: 2500,
        minCapacity: 1,
        maxCapacity,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'PUBLISHED',
      },
    });
    exp[key] = experience.id;
    return experience.id;
  }

  function occurrence(
    key: string,
    date: Date,
    startTime: string,
    options: {
      status?: OccurrenceStatus;
      capacityOverride?: number | null;
    } = {}
  ) {
    const experienceId = exp[key];
    if (!experienceId) throw new Error(`unknown experience ${key}`);
    return db.experienceOccurrence.create({
      data: {
        experienceId,
        date,
        startTime,
        status: options.status ?? OccurrenceStatus.OPEN,
        capacityOverride: options.capacityOverride ?? null,
        source: 'PUNCTUAL',
      },
    });
  }

  function booking(
    key: string,
    date: Date,
    timeSlot: string,
    guestCount: number,
    status: BookingStatus,
    expiresAt: Date | null = null
  ) {
    const experienceId = exp[key];
    if (!experienceId || !ids.wineryId) throw new Error('fixture missing');
    return db.booking.create({
      data: {
        reference: `ENC-A7${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        visitorEmail: `a7-${Math.random().toString(36).slice(2, 8)}@test.encave.ch`,
        visitorName: 'Client A7',
        visitorPhone: '+41790000031',
        experienceId,
        wineryId: ids.wineryId,
        date,
        timeSlot,
        guestCount,
        totalPrice: guestCount * 2500,
        platformFee: guestCount * 300,
        wineryPayout: guestCount * 2200,
        status,
        expiresAt,
      },
    });
  }

  const scopeWhere = () => ({ wineryId: ids.wineryId });

  async function reference(from: Date, to: Date | undefined) {
    const experiences = await db.experience.findMany({
      where: scopeWhere(),
      select: { id: true, maxCapacity: true },
    });
    return scanNextBookableOccurrences(
      from,
      to,
      new Map(experiences.map((e) => [e.id, e.maxCapacity])),
      now
    );
  }

  const plain = (
    map: Map<string, { date: Date; startTime: string }>
  ): Record<string, string> =>
    Object.fromEntries(
      Array.from(map.entries())
        .map(([experienceId, o]): [string, string] => {
          const key =
            Object.keys(exp).find((k) => exp[k] === experienceId) ??
            experienceId;
          return [key, `${o.date.toISOString().slice(0, 10)} ${o.startTime}`];
        })
        .sort(([a], [b]) => a.localeCompare(b))
    );

  beforeAll(async () => {
    ({ mapNextBookableOccurrences, scanNextBookableOccurrences } =
      await import('@/server/queries/experience.queries'));
    db = new PrismaClient({ datasourceUrl: url });

    const user = await db.user.create({
      data: { email: `a7-${run}@test.encave.ch`, role: 'WINEMAKER' },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `A7 Winery ${run}`,
        slug: `a7-${run}`,
        description: 'A7 test fixture',
        address: 'Route du Test 31',
        commune: 'Sion',
        phone: '+41270000031',
        email: 'a7@test.encave.ch',
        userId: user.id,
        status: 'VERIFIED',
      },
    });
    ids.wineryId = winery.id;

    // simple — soonest of three, same-day ordering by start time.
    await makeExperience('simple');
    await occurrence('simple', day(3), '16:00');
    await occurrence('simple', day(1), '14:00');
    await occurrence('simple', day(1), '10:00');

    // closedFirst — CLOSED and CANCELLED occurrences are never candidates.
    await makeExperience('closedFirst');
    await occurrence('closedFirst', day(0), '10:00', {
      status: OccurrenceStatus.CLOSED,
    });
    await occurrence('closedFirst', day(1), '10:00', {
      status: OccurrenceStatus.CANCELLED,
    });
    await occurrence('closedFirst', day(4), '11:00');

    // blockedFirst — a blackout day is skipped (D3), the next day wins.
    await makeExperience('blockedFirst');
    await occurrence('blockedFirst', day(0), '10:00');
    await occurrence('blockedFirst', day(0), '15:00');
    await occurrence('blockedFirst', day(2), '10:00');
    await db.blockedDate.create({
      data: { experienceId: exp.blockedFirst ?? '', date: day(0) },
    });

    // onlyBlocked — its single occurrence is blacked out → no result.
    await makeExperience('onlyBlocked');
    await occurrence('onlyBlocked', day(1), '10:00');
    await db.blockedDate.create({
      data: { experienceId: exp.onlyBlocked ?? '', date: day(1) },
    });

    // fullFirst — soonest slot sold out (8/8: CONFIRMED + COMPLETED +
    // NO_SHOW + a LIVE hold) → fallback finds the afternoon slot.
    await makeExperience('fullFirst');
    await occurrence('fullFirst', day(0), '10:00');
    await occurrence('fullFirst', day(0), '14:00');
    await booking('fullFirst', day(0), '10:00', 3, BookingStatus.CONFIRMED);
    await booking('fullFirst', day(0), '10:00', 2, BookingStatus.COMPLETED);
    await booking('fullFirst', day(0), '10:00', 1, BookingStatus.NO_SHOW);
    await booking(
      'fullFirst',
      day(0),
      '10:00',
      2,
      BookingStatus.PENDING_PAYMENT,
      new Date(now.getTime() + 60 * 60 * 1000)
    );

    // overrideFull — override 2 is sold out although maxCapacity is 8;
    // the next slot has an override of 3 with 2 seats taken → bookable.
    await makeExperience('overrideFull');
    await occurrence('overrideFull', day(1), '10:00', { capacityOverride: 2 });
    await occurrence('overrideFull', day(5), '10:00', { capacityOverride: 3 });
    await booking('overrideFull', day(1), '10:00', 2, BookingStatus.CONFIRMED);
    await booking('overrideFull', day(5), '10:00', 2, BookingStatus.CONFIRMED);

    // freedSeats — seats that do NOT count: a cancelled booking and an
    // EXPIRED hold → the soonest slot stays bookable.
    await makeExperience('freedSeats');
    await occurrence('freedSeats', day(2), '09:00');
    await booking(
      'freedSeats',
      day(2),
      '09:00',
      8,
      BookingStatus.CANCELLED_BY_CLIENT
    );
    await booking(
      'freedSeats',
      day(2),
      '09:00',
      8,
      BookingStatus.PENDING_PAYMENT,
      new Date(now.getTime() - 60 * 60 * 1000)
    );

    // allFull — every slot sold out → no result at all.
    await makeExperience('allFull', 2);
    await occurrence('allFull', day(0), '10:00');
    await occurrence('allFull', day(1), '10:00');
    await booking('allFull', day(0), '10:00', 2, BookingStatus.CONFIRMED);
    await booking('allFull', day(1), '10:00', 2, BookingStatus.CONFIRMED);

    // late — only reachable when the window extends to day 20.
    await makeExperience('late');
    await occurrence('late', day(20), '10:00');

    // none — no occurrence.
    await makeExperience('none');
  });

  afterAll(async () => {
    if (ids.wineryId) {
      await db.booking.deleteMany({ where: { wineryId: ids.wineryId } });
      await db.winery.delete({ where: { id: ids.wineryId } });
    }
    if (ids.userId) {
      await db.user.delete({ where: { id: ids.userId } });
    }
    await db.$disconnect();
  });

  it('returns the soonest bookable occurrence of each experience (open window)', async () => {
    const result = await mapNextBookableOccurrences(
      day(0),
      undefined,
      scopeWhere(),
      now
    );

    expect(plain(result)).toEqual({
      blockedFirst: '2099-03-04 10:00',
      closedFirst: '2099-03-06 11:00',
      freedSeats: '2099-03-04 09:00',
      fullFirst: '2099-03-02 14:00',
      late: '2099-03-22 10:00',
      overrideFull: '2099-03-07 10:00',
      simple: '2099-03-03 10:00',
    });
    // onlyBlocked, allFull and none have nothing bookable.
    expect(result.has(exp.onlyBlocked ?? '')).toBe(false);
    expect(result.has(exp.allFull ?? '')).toBe(false);
    expect(result.has(exp.none ?? '')).toBe(false);
  });

  it('honours both bounds of the window (inclusive)', async () => {
    const result = await mapNextBookableOccurrences(
      day(1),
      day(4),
      scopeWhere(),
      now
    );

    expect(plain(result)).toEqual({
      // day 0 is before the window: blockedFirst's day-2 slot still wins,
      // fullFirst has nothing left inside [1, 4].
      blockedFirst: '2099-03-04 10:00',
      // upper bound inclusive (day 4).
      closedFirst: '2099-03-06 11:00',
      freedSeats: '2099-03-04 09:00',
      simple: '2099-03-03 10:00',
    });
  });

  it('matches the exhaustive reference scan on every window', async () => {
    const windows: Array<[Date, Date | undefined]> = [
      [day(0), undefined],
      [day(0), day(0)],
      [day(0), day(1)],
      [day(1), day(4)],
      [day(2), day(5)],
      [day(5), day(30)],
      [day(21), undefined],
      [day(-10), day(-1)],
    ];
    for (const [from, to] of windows) {
      const [fast, slow] = await Promise.all([
        mapNextBookableOccurrences(from, to, scopeWhere(), now),
        reference(from, to),
      ]);
      expect(plain(fast)).toEqual(plain(slow));
    }
  });

  it('respects the experience filter and returns nothing for an empty scope', async () => {
    const onlySimple = await mapNextBookableOccurrences(
      day(0),
      undefined,
      { id: exp.simple },
      now
    );
    expect(plain(onlySimple)).toEqual({ simple: '2099-03-03 10:00' });

    const empty = await mapNextBookableOccurrences(
      day(0),
      undefined,
      { id: 'does-not-exist' },
      now
    );
    expect(empty.size).toBe(0);
  });

  it('uses the (experienceId, date, startTime) index for the top-1 probe', async () => {
    // Planner sanity on real Postgres: with seq scans disabled the lateral
    // probe must be an index scan on the occurrence unique — a regression
    // to a full scan + sort would show up here.
    const plan = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
      return tx.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
        `EXPLAIN SELECT occ."date", occ."startTime"
         FROM "experience_occurrences" occ
         WHERE occ."experienceId" = $1
           AND occ."status" = 'OPEN'::"OccurrenceStatus"
           AND occ."date" >= '2099-03-02'::date
         ORDER BY occ."date" ASC, occ."startTime" ASC
         LIMIT 1`,
        exp.simple
      );
    });
    const text = plan.map((row) => row['QUERY PLAN']).join('\n');
    expect(text).toMatch(/Index Scan/);
    expect(text).not.toMatch(/Sort/);
  });
});
