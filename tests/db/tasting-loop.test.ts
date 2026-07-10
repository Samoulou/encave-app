/**
 * P-07 tasting loop — against a REAL migrated database.
 * Covers the D1 fan-out (active bookings only), the A1 producer dedup
 * (one TASTING_RECAP job per booking, re-arm semantics), the D2 late-fill
 * rule (runAt ≈ now when filled > J+2) and the flag OFF gate.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npx vitest run tests/db
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  PrismaClient,
  BookingStatus,
  ScheduledJobStatus,
} from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-forwarded-for': `198.51.100.${(process.pid + 7) % 250}` }),
}));

// Owner-scoped action: authenticate as the fixture winemaker.
const authState: { userId: string | null } = { userId: null };
vi.mock('@/server/auth', () => ({
  auth: vi.fn(async () =>
    authState.userId
      ? {
          user: {
            id: authState.userId,
            email: 'tasting-loop@test.encave.ch',
            name: 'Tasting Loop',
            role: 'WINEMAKER',
            preferredLocale: 'FR',
          },
        }
      : null
  ),
}));

type TastingSheetActions = typeof import('@/server/actions/tasting-sheet');

/**
 * N days ago as a YYYY-MM-DD key (UTC). 4 days out = the session ended
 * more than 48h ago, so the D2 late-fill rule (runAt ≈ now) is observable.
 */
function daysAgoKey(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

describe.skipIf(!url)('tasting loop (P-07 / L-061, L-062)', () => {
  let db: PrismaClient;
  let saveTastingSheet: TastingSheetActions['saveTastingSheet'];
  const ids: {
    userId?: string;
    wineryId?: string;
    experienceId?: string;
    wineA?: string;
    wineB?: string;
  } = {};
  let bookingConfirmed: string;
  let bookingCompleted: string;
  let bookingCancelled: string;

  const dateKey = daysAgoKey(4);
  const timeSlot = '10:00';

  async function setFlag(enabled: boolean): Promise<void> {
    await db.featureFlag.upsert({
      where: { key: 'TASTING_SHEET' },
      update: { enabled },
      create: { key: 'TASTING_SHEET', enabled },
    });
  }

  function makeBooking(status: BookingStatus, email: string) {
    if (!ids.experienceId || !ids.wineryId) throw new Error('fixture missing');
    return db.booking.create({
      data: {
        reference: `ENC-TL${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        visitorEmail: email,
        visitorName: 'Client Test',
        visitorPhone: '+41790000000',
        experienceId: ids.experienceId,
        wineryId: ids.wineryId,
        date: new Date(`${dateKey}T00:00:00.000Z`),
        timeSlot,
        guestCount: 2,
        totalPrice: 5000,
        platformFee: 600,
        wineryPayout: 4400,
        status,
      },
      select: { id: true },
    });
  }

  beforeAll(async () => {
    ({ saveTastingSheet } = await import('@/server/actions/tasting-sheet'));
    db = new PrismaClient({ datasourceUrl: url });
    const user = await db.user.create({
      data: {
        email: `tasting-loop-${Date.now()}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    authState.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Tasting Loop Winery ${Date.now()}`,
        slug: `tasting-loop-${Date.now()}`,
        description: 'Tasting loop test fixture',
        address: 'Route du Test 7',
        commune: 'Sion',
        phone: '+41270000007',
        email: 'tasting-loop@test.encave.ch',
        userId: user.id,
        status: 'VERIFIED',
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Tasting Loop Experience',
        slug: `tasting-loop-${Date.now()}`,
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
    const [wineA, wineB] = await Promise.all([
      db.wine.create({
        data: {
          wineryId: winery.id,
          name: 'Fendant Test',
          grapeVariety: 'Chasselas',
          vintage: 2024,
          price: 2450,
        },
        select: { id: true },
      }),
      db.wine.create({
        data: {
          wineryId: winery.id,
          name: 'Cornalin Test',
          grapeVariety: 'Cornalin',
          vintage: 2023,
          price: 3200,
        },
        select: { id: true },
      }),
    ]);
    ids.wineA = wineA.id;
    ids.wineB = wineB.id;

    // Yesterday 10:00 session: one CONFIRMED, one COMPLETED, one cancelled,
    // one live hold (sentinel email) — only the first two are "active".
    bookingConfirmed = (
      await makeBooking(BookingStatus.CONFIRMED, 'alice@test.encave.ch')
    ).id;
    bookingCompleted = (
      await makeBooking(BookingStatus.COMPLETED, 'bob@test.encave.ch')
    ).id;
    bookingCancelled = (
      await makeBooking(
        BookingStatus.CANCELLED_BY_CLIENT,
        'carol@test.encave.ch'
      )
    ).id;
    await makeBooking(
      BookingStatus.PENDING_PAYMENT,
      'hold-1@holds.encave.internal'
    );

    await setFlag(true);
  });

  afterAll(async () => {
    await setFlag(false);
    if (ids.wineryId) {
      await db.booking
        .deleteMany({ where: { wineryId: ids.wineryId } })
        .catch(() => {});
      await db.scheduledJob
        .deleteMany({ where: { type: 'TASTING_RECAP' } })
        .catch(() => {});
    }
    if (ids.userId) {
      await db.user.delete({ where: { id: ids.userId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  it('flag OFF: the action is FORBIDDEN and nothing is written', async () => {
    await setFlag(false);
    try {
      const result = await saveTastingSheet({
        experienceId: ids.experienceId,
        date: dateKey,
        timeSlot,
        wineIds: [ids.wineA],
      });
      expect(result).toMatchObject({
        success: false,
        error: { code: 'FORBIDDEN' },
      });
      const wines = await db.bookingWine.count({
        where: { bookingId: bookingConfirmed },
      });
      expect(wines).toBe(0);
    } finally {
      await setFlag(true);
    }
  });

  it('fans out to CONFIRMED + COMPLETED bookings only, arming one job each', async () => {
    const result = await saveTastingSheet({
      experienceId: ids.experienceId,
      date: dateKey,
      timeSlot,
      wineIds: [ids.wineA, ids.wineB],
    });
    expect(result).toMatchObject({
      success: true,
      data: { bookingCount: 2, wineCount: 2 },
    });

    const [confirmedWines, completedWines, cancelledWines] = await Promise.all(
      [bookingConfirmed, bookingCompleted, bookingCancelled].map((bookingId) =>
        db.bookingWine.count({ where: { bookingId } })
      )
    );
    expect(confirmedWines).toBe(2);
    expect(completedWines).toBe(2);
    expect(cancelledWines).toBe(0);

    // No job for the cancelled booking nor the hold.
    const jobs = await db.scheduledJob.findMany({
      where: { type: 'TASTING_RECAP' },
      select: { dedupeKey: true, status: true, runAt: true },
    });
    expect(jobs.map((j) => j.dedupeKey).sort()).toEqual(
      [
        `TASTING_RECAP:${bookingConfirmed}`,
        `TASTING_RECAP:${bookingCompleted}`,
      ].sort()
    );
    expect(jobs.every((j) => j.status === ScheduledJobStatus.PENDING)).toBe(
      true
    );
    // D2 late fill: the session ended yesterday but was filled today —
    // runAt = max(end + 48h, now) which is within the next minute.
    for (const job of jobs) {
      expect(Math.abs(job.runAt.getTime() - Date.now())).toBeLessThan(60_000);
    }
  });

  it('saving twice keeps exactly one job per booking (dedup)', async () => {
    const again = await saveTastingSheet({
      experienceId: ids.experienceId,
      date: dateKey,
      timeSlot,
      wineIds: [ids.wineA],
    });
    expect(again).toMatchObject({ success: true });

    const jobs = await db.scheduledJob.count({
      where: { type: 'TASTING_RECAP' },
    });
    expect(jobs).toBe(2);

    // The sheet now holds only wineA (sync semantics).
    const confirmedWines = await db.bookingWine.findMany({
      where: { bookingId: bookingConfirmed },
      select: { wineId: true },
    });
    expect(confirmedWines.map((w) => w.wineId)).toEqual([ids.wineA]);
  });

  it('clearing the sheet cancels PENDING jobs; re-filling re-arms them', async () => {
    const cleared = await saveTastingSheet({
      experienceId: ids.experienceId,
      date: dateKey,
      timeSlot,
      wineIds: [],
    });
    expect(cleared).toMatchObject({
      success: true,
      data: { wineCount: 0, recapRunAt: null },
    });
    const afterClear = await db.scheduledJob.findMany({
      where: { type: 'TASTING_RECAP' },
      select: { status: true },
    });
    expect(
      afterClear.every((j) => j.status === ScheduledJobStatus.CANCELLED)
    ).toBe(true);
    const wines = await db.bookingWine.count({
      where: { bookingId: { in: [bookingConfirmed, bookingCompleted] } },
    });
    expect(wines).toBe(0);

    const refilled = await saveTastingSheet({
      experienceId: ids.experienceId,
      date: dateKey,
      timeSlot,
      wineIds: [ids.wineB],
    });
    expect(refilled).toMatchObject({ success: true });
    const afterRefill = await db.scheduledJob.findMany({
      where: { type: 'TASTING_RECAP' },
      select: { status: true, attempts: true },
    });
    expect(afterRefill).toHaveLength(2);
    expect(
      afterRefill.every(
        (j) => j.status === ScheduledJobStatus.PENDING && j.attempts === 0
      )
    ).toBe(true);
  });

  it("rejects another winery's wine on the sheet", async () => {
    const otherUser = await db.user.create({
      data: {
        email: `tasting-loop-other-${Date.now()}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    try {
      const otherWinery = await db.winery.create({
        data: {
          name: `Other Winery ${Date.now()}`,
          slug: `tasting-loop-other-${Date.now()}`,
          description: 'Other winery fixture',
          address: 'Route du Test 8',
          commune: 'Sierre',
          phone: '+41270000008',
          email: 'tasting-loop-other@test.encave.ch',
          userId: otherUser.id,
          status: 'VERIFIED',
        },
      });
      const foreignWine = await db.wine.create({
        data: {
          wineryId: otherWinery.id,
          name: 'Foreign Wine',
          grapeVariety: 'Gamay',
          price: 1900,
        },
        select: { id: true },
      });

      const result = await saveTastingSheet({
        experienceId: ids.experienceId,
        date: dateKey,
        timeSlot,
        wineIds: [foreignWine.id],
      });
      expect(result).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
    } finally {
      await db.user.delete({ where: { id: otherUser.id } }).catch(() => {});
    }
  });
});
