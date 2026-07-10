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

// Observable, deterministic sends: the recap handler is exercised against
// the real DB but the actual Resend call is mocked (count = deliveries).
vi.mock('@/server/services/email.service', () => ({
  sendTastingRecapEmail: vi.fn(async () => ({
    ok: true,
    messageId: `msg_${Math.random().toString(36).slice(2)}`,
  })),
  sendWineOrderRequestEmails: vi.fn(async () => ({
    winery: true,
    client: true,
  })),
  sendPostExperienceFollowUpEmail: vi.fn(async () => true),
}));

// The D4 test drives the follow-ups cron route directly.
vi.mock('@/lib/cron-auth', () => ({
  verifyCronRequest: vi.fn(async () => true),
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
type ScheduledJobsService =
  typeof import('@/server/services/scheduled-jobs.service');
type TastingRecapService =
  typeof import('@/server/services/tasting-recap.service');

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
  let runDueJobs: ScheduledJobsService['runDueJobs'];
  let processTastingRecapJob: TastingRecapService['processTastingRecapJob'];
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
    ({ runDueJobs } = await import('@/server/services/scheduled-jobs.service'));
    ({ processTastingRecapJob } =
      await import('@/server/services/tasting-recap.service'));
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
      await db.emailLog
        .deleteMany({ where: { wineryId: ids.wineryId } })
        .catch(() => {});
      await db.booking
        .deleteMany({ where: { wineryId: ids.wineryId } })
        .catch(() => {});
      await db.scheduledJob
        .deleteMany({ where: { type: 'TASTING_RECAP' } })
        .catch(() => {});
      await db.clientEmailPreference
        .deleteMany({ where: { email: { endsWith: '@test.encave.ch' } } })
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

  it('runner: flag OFF (type not enabled) never claims — jobs stay PENDING, 0 attempts consumed', async () => {
    // State from the previous test: 2 PENDING jobs, due (runAt ≈ re-fill).
    const before = await db.scheduledJob.findMany({
      where: { type: 'TASTING_RECAP' },
      select: { id: true, attempts: true },
    });
    expect(before).toHaveLength(2);

    const handlers = { TASTING_RECAP: processTastingRecapJob };
    const stats = await runDueJobs({ enabledTypes: [], handlers });
    expect(stats.claimed).toBe(0);

    const after = await db.scheduledJob.findMany({
      where: { type: 'TASTING_RECAP' },
      select: { id: true, status: true, attempts: true },
    });
    expect(after.every((j) => j.status === ScheduledJobStatus.PENDING)).toBe(
      true
    );
    expect(after.map((j) => j.attempts)).toEqual(before.map((j) => j.attempts));
  });

  it('runner: drains due jobs exactly once (second pass sends nothing)', async () => {
    const { sendTastingRecapEmail } =
      await import('@/server/services/email.service');
    const sendMock = vi.mocked(sendTastingRecapEmail);
    sendMock.mockClear();

    const handlers = { TASTING_RECAP: processTastingRecapJob };
    const first = await runDueJobs({
      enabledTypes: ['TASTING_RECAP'],
      handlers,
    });
    expect(first).toMatchObject({ claimed: 2, done: 2, failed: 0 });
    expect(sendMock).toHaveBeenCalledTimes(2);

    // Recap state persisted per booking.
    const bookings = await db.booking.findMany({
      where: { id: { in: [bookingConfirmed, bookingCompleted] } },
      select: { tastingRecapSentAt: true, recapTokenHash: true },
    });
    expect(
      bookings.every(
        (b) => b.tastingRecapSentAt !== null && b.recapTokenHash !== null
      )
    ).toBe(true);

    // Opt-out rows were get-or-created for both guests.
    const prefs = await db.clientEmailPreference.count({
      where: { email: { in: ['alice@test.encave.ch', 'bob@test.encave.ch'] } },
    });
    expect(prefs).toBe(2);

    // Second pass: everything is DONE, nothing to claim, zero sends.
    const second = await runDueJobs({
      enabledTypes: ['TASTING_RECAP'],
      handlers,
    });
    expect(second).toMatchObject({ claimed: 0, done: 0 });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('runner: an opted-out client gets the job CANCELLED, no send', async () => {
    const { sendTastingRecapEmail } =
      await import('@/server/services/email.service');
    const sendMock = vi.mocked(sendTastingRecapEmail);
    sendMock.mockClear();

    // New guest on the same session, opted out beforehand.
    const optedOut = await makeBooking(
      BookingStatus.CONFIRMED,
      'dave@test.encave.ch'
    );
    await db.clientEmailPreference.upsert({
      where: { email: 'dave@test.encave.ch' },
      update: { marketingOptOut: true },
      create: { email: 'dave@test.encave.ch', marketingOptOut: true },
    });
    // Re-save the sheet: arms a job for the new booking only (others DONE).
    const saved = await saveTastingSheet({
      experienceId: ids.experienceId,
      date: dateKey,
      timeSlot,
      wineIds: [ids.wineB],
    });
    expect(saved).toMatchObject({ success: true });

    const stats = await runDueJobs({
      enabledTypes: ['TASTING_RECAP'],
      handlers: { TASTING_RECAP: processTastingRecapJob },
    });
    expect(stats).toMatchObject({ claimed: 1, cancelled: 1, done: 0 });
    expect(sendMock).not.toHaveBeenCalled();

    const job = await db.scheduledJob.findUnique({
      where: { dedupeKey: `TASTING_RECAP:${optedOut.id}` },
      select: { status: true, lastError: true },
    });
    expect(job).toMatchObject({
      status: ScheduledJobStatus.CANCELLED,
      lastError: 'opted_out',
    });
    const booking = await db.booking.findUnique({
      where: { id: optedOut.id },
      select: { tastingRecapSentAt: true },
    });
    expect(booking?.tastingRecapSentAt).toBeNull();

    // Skip is auditable.
    const skipped = await db.emailLog.count({
      where: {
        type: 'tasting_recap',
        status: 'skipped',
        bookingId: optedOut.id,
      },
    });
    expect(skipped).toBe(1);
  });

  it('wine order: two concurrent 1-taps → exactly one request row', async () => {
    const { submitWineOrderRequest } =
      await import('@/server/actions/tasting-sheet');
    // Arm a recap token on the confirmed booking (what the email carries).
    const crypto = await import('crypto');
    const token = 'b'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await db.booking.update({
      where: { id: bookingConfirmed },
      data: { recapTokenHash: tokenHash },
    });

    const input = {
      bookingId: bookingConfirmed,
      token,
      items: [{ wineId: ids.wineB, quantity: 3 }],
    };
    const [first, second] = await Promise.all([
      submitWineOrderRequest(input),
      submitWineOrderRequest(input),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((r) => r.success)).toHaveLength(1);
    expect(
      outcomes.filter((r) => !r.success && r.error.code === 'CONFLICT')
    ).toHaveLength(1);

    const rows = await db.wineOrderRequest.findMany({
      where: { bookingId: bookingConfirmed },
      include: { items: true },
    });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error('missing request row');
    expect(row.clientEmail).toBe('alice@test.encave.ch');
    expect(row.items).toHaveLength(1);
    expect(row.items[0]).toMatchObject({
      quantity: 3,
      priceAtRequest: 3200,
      wineName: 'Cornalin Test',
    });
  });

  it('D4: the J+1 follow-up is skipped when a recap is armed, sent otherwise, and sent again under flag OFF', async () => {
    const { GET: runFollowUps } =
      await import('@/app/api/cron/follow-ups/route');
    const { sendPostExperienceFollowUpEmail } =
      await import('@/server/services/email.service');
    const followUpMock = vi.mocked(sendPostExperienceFollowUpEmail);
    followUpMock.mockClear();

    // Two sessions that ended ~22.5h/23h ago (inside the follow-up
    // 22-26h window, duration 90min): A gets its sheet filled (recap
    // armed), B does not.
    const startA = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const startB = new Date(Date.now() - 24.5 * 60 * 60 * 1000);
    const localSlot = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
      ).padStart(2, '0')}`;
    const localDateUTC = (d: Date) =>
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const makeWindowBooking = (start: Date, email: string) => {
      if (!ids.experienceId || !ids.wineryId) throw new Error('fixture');
      return db.booking.create({
        data: {
          reference: `ENC-D4${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          visitorEmail: email,
          visitorName: 'Client D4',
          visitorPhone: '+41790000001',
          experienceId: ids.experienceId,
          wineryId: ids.wineryId,
          date: localDateUTC(start),
          timeSlot: localSlot(start),
          guestCount: 2,
          totalPrice: 5000,
          platformFee: 600,
          wineryPayout: 4400,
          status: BookingStatus.COMPLETED,
        },
        select: { id: true, date: true, timeSlot: true },
      });
    };
    const bookingArmed = await makeWindowBooking(startA, 'erin@test.encave.ch');
    const bookingPlain = await makeWindowBooking(
      startB,
      'frank@test.encave.ch'
    );

    // Fill the sheet on session A only → recap armed for bookingArmed.
    const saved = await saveTastingSheet({
      experienceId: ids.experienceId,
      date: bookingArmed.date.toISOString().slice(0, 10),
      timeSlot: bookingArmed.timeSlot,
      wineIds: [ids.wineA],
    });
    expect(saved).toMatchObject({ success: true });

    // Flag ON: A skipped (no followUpSentAt), B sent.
    await runFollowUps();
    let [armed, plain] = await Promise.all([
      db.booking.findUniqueOrThrow({
        where: { id: bookingArmed.id },
        select: { followUpSentAt: true },
      }),
      db.booking.findUniqueOrThrow({
        where: { id: bookingPlain.id },
        select: { followUpSentAt: true },
      }),
    ]);
    expect(armed.followUpSentAt).toBeNull();
    expect(plain.followUpSentAt).not.toBeNull();
    expect(followUpMock).toHaveBeenCalledTimes(1);
    const skipLog = await db.emailLog.count({
      where: {
        type: 'follow_up',
        status: 'skipped',
        bookingId: bookingArmed.id,
      },
    });
    expect(skipLog).toBe(1);

    // Flag OFF (D4 strict): the armed booking now receives the generic
    // follow-up — current behavior restored.
    await setFlag(false);
    try {
      await runFollowUps();
    } finally {
      await setFlag(true);
    }
    [armed, plain] = await Promise.all([
      db.booking.findUniqueOrThrow({
        where: { id: bookingArmed.id },
        select: { followUpSentAt: true },
      }),
      db.booking.findUniqueOrThrow({
        where: { id: bookingPlain.id },
        select: { followUpSentAt: true },
      }),
    ]);
    expect(armed.followUpSentAt).not.toBeNull();
    expect(followUpMock).toHaveBeenCalledTimes(2);
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
