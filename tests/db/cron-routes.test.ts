/**
 * Lot 2 P0 — route-level tests of the 9 cron handlers against a REAL
 * migrated database (pre-launch test plan, volet A).
 *
 * Under test, for every route in src/app/api/cron/:
 * - the REAL verifyCronRequest (x-vercel-cron / Bearer CRON_SECRET) — the
 *   auth is the object of the suite, so @/lib/cron-auth is NOT mocked
 *   (unlike tasting-loop.test.ts); next/headers is a mutable stub instead,
 * - the Europe/Zurich hour guards (18h reminders, 21h tasting sheet) in
 *   BOTH DST regimes, via fake timers,
 * - the feature-flag kill-switches (TASTING_SHEET, GIFT_CARDS) read from
 *   the real feature_flags table.
 *
 * Doctrine note: the ?window=/?slot= query params of vercel.json exist
 * only to mint distinct daily cron entries (Vercel Hobby rejects sub-daily
 * schedules) — every handler is `GET()` without a request argument and
 * decides from the CLOCK, so the suite calls the handlers bare.
 *
 * Run with:
 *   $env:INVARIANTS_DATABASE_URL='postgresql://postgres:postgres@localhost:5433/encave_inv_lot2'
 *   npx vitest run tests/db/cron-routes.test.ts
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import {
  PrismaClient,
  BookingStatus,
  GiftCardStatus,
  ScheduledJobStatus,
} from '@prisma/client';

import { GIFT_CARD_DELIVERY_JOB_TYPE } from '@/lib/constants/gift-card';
import { makeStripeStub } from './helpers/stripe-stub';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

// verifyCronRequest reads env.CRON_SECRET through @/lib/env, whose Zod
// schema requires >= 32 chars and is parsed ONCE at first import — set it
// before the dynamic imports of beforeAll load the env module.
const CRON_SECRET = 'dbtest-cron-secret-0123456789abcdef';
process.env.CRON_SECRET = CRON_SECRET;
// Without a DSN, withCronMonitor is a plain passthrough (no check-ins) and
// the routes' Sentry.captureMessage calls are no-ops — pin that state.
delete process.env.NEXT_PUBLIC_SENTRY_DSN;

// The REAL cron auth reads next/headers: mutable state that each simulated
// invocation points at its own header set.
const headerState = { current: new Headers() };
vi.mock('next/headers', () => ({
  headers: async () => headerState.current,
}));

// Observable no-op sends — every email function reachable from the 9 cron
// routes' import graph (routes + booking-expiration, tasting-recap,
// giftCard-delivery/-purchase, request-jobs services).
vi.mock('@/server/services/email.service', () => ({
  sendBookingReminderEmail: vi.fn(async () => true),
  sendClientReminder2hEmail: vi.fn(async () => true),
  sendDailyDigestEmail: vi.fn(async () => true),
  sendPostExperienceFollowUpEmail: vi.fn(async () => true),
  sendWeeklySummaryEmail: vi.fn(async () => true),
  sendTastingSheetReminderEmail: vi.fn(async () => true),
  sendBookingExpiredEmail: vi.fn(async () => true),
  sendTastingRecapEmail: vi.fn(async () => ({
    ok: true,
    messageId: 'msg_dbtest_recap',
  })),
  sendGiftCardDeliveryEmail: vi.fn(async () => ({
    ok: true,
    messageId: 'msg_dbtest_gift',
  })),
  sendGiftCardPurchaseEmail: vi.fn(async () => ({
    ok: true,
    messageId: 'msg_dbtest_gift_purchase',
  })),
  sendRequestOfferExpiringEmail: vi.fn(async () => true),
  sendRequestSlaEscalationEmail: vi.fn(async () => true),
  sendWineOrderRequestEmails: vi.fn(async () => ({
    winery: true,
    client: true,
  })),
}));

// Real route/service code, stubbed Stripe network surface (lazy factory —
// the const is initialized before the first dynamic import runs it).
const stripeStub = makeStripeStub();
vi.mock('@/server/stripe', () => ({
  isStripeConfigured: () => true,
  getStripe: () => stripeStub.client,
}));

// @react-pdf/renderer is irrelevant to the cron contract — the delivery
// handler only needs a Buffer to attach.
vi.mock('@/server/services/giftCard-pdf.service', () => ({
  generateGiftCardPDF: vi.fn(async () => Buffer.from('%PDF-dbtest')),
}));

type CronRouteModule = { GET: () => Promise<Response> };

const CRON_ROUTES: Array<{
  name: string;
  load: () => Promise<CronRouteModule>;
}> = [
  { name: 'reminders', load: () => import('@/app/api/cron/reminders/route') },
  {
    name: 'daily-digest',
    load: () => import('@/app/api/cron/daily-digest/route'),
  },
  {
    name: 'expire-pending-bookings',
    load: () => import('@/app/api/cron/expire-pending-bookings/route'),
  },
  {
    name: 'generate-occurrences',
    load: () => import('@/app/api/cron/generate-occurrences/route'),
  },
  {
    name: 'follow-ups',
    load: () => import('@/app/api/cron/follow-ups/route'),
  },
  {
    name: 'weekly-summary',
    load: () => import('@/app/api/cron/weekly-summary/route'),
  },
  {
    name: 'process-scheduled-jobs',
    load: () => import('@/app/api/cron/process-scheduled-jobs/route'),
  },
  {
    name: 'tasting-sheet-reminder',
    load: () => import('@/app/api/cron/tasting-sheet-reminder/route'),
  },
  {
    name: 'reconcile-gift-transfers',
    load: () => import('@/app/api/cron/reconcile-gift-transfers/route'),
  },
];

function setRequestHeaders(headers: Record<string, string> = {}): void {
  headerState.current = new Headers(headers);
}

describe.skipIf(!url)('cron routes (lot 2 P0 — auth, guards, flags)', () => {
  let db: PrismaClient;
  // Unique tag woven into every fixture identifier/email so the afterAll
  // cleanup can sweep exactly what this run created.
  const RUN_TAG = `cronrt${Date.now()}`;
  const ids: {
    userId?: string;
    wineryId?: string;
    experienceId?: string;
    giftCardId?: string;
  } = {};
  const wineryEmail = `${RUN_TAG}-cave@test.encave.ch`;

  async function setFlag(
    key: 'TASTING_SHEET' | 'GIFT_CARDS' | 'REQUESTS',
    enabled: boolean
  ): Promise<void> {
    await db.featureFlag.upsert({
      where: { key },
      update: { enabled },
      create: { key, enabled },
    });
  }

  function makeBooking(input: {
    date: Date;
    status: BookingStatus;
    email: string;
    timeSlot?: string;
  }) {
    if (!ids.experienceId || !ids.wineryId) throw new Error('fixture missing');
    return db.booking.create({
      data: {
        reference: `ENC-CR${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        visitorEmail: input.email,
        visitorName: 'Client Cron',
        visitorPhone: '+41790000002',
        experienceId: ids.experienceId,
        wineryId: ids.wineryId,
        date: input.date,
        timeSlot: input.timeSlot ?? '10:00',
        guestCount: 2,
        totalPrice: 5000,
        platformFee: 600,
        wineryPayout: 4400,
        status: input.status,
      },
      select: { id: true },
    });
  }

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });

    // The invariants DB persists across local runs: a run killed before a
    // sibling suite's afterAll can leave due PENDING GIFT_CARD_DELIVERY jobs
    // or CONFIRMED gift bookings awaiting settle, and this suite's runner /
    // reconcile assertions are exact DB-WIDE counts. Neutralize leftovers
    // (safe under --no-file-parallelism — nothing else is in flight).
    await db.scheduledJob.updateMany({
      where: { type: 'GIFT_CARD_DELIVERY', status: 'PENDING' },
      data: { status: 'CANCELLED', lastError: 'stale_neutralized_by_test' },
    });
    await db.booking.updateMany({
      where: {
        status: 'CONFIRMED',
        giftAppliedCents: { gt: 0 },
        giftTransferId: null,
      },
      data: { giftTransferId: 'tr_stale_neutralized_by_test' },
    });

    const user = await db.user.create({
      data: {
        email: `${RUN_TAG}-owner@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Cron Routes Winery ${RUN_TAG}`,
        slug: `cron-routes-${RUN_TAG}`,
        description: 'Cron routes test fixture',
        address: 'Route du Test 9',
        commune: 'Sion',
        phone: '+41270000009',
        email: wineryEmail,
        userId: user.id,
        status: 'VERIFIED',
      },
    });
    ids.wineryId = winery.id;
    // DRAFT on purpose: the auth-matrix 200 runs of generate-occurrences
    // must sweep ZERO experiences (quasi-empty base doctrine).
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Cron Routes Experience',
        slug: `cron-routes-${RUN_TAG}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 90,
        price: 2500,
        minCapacity: 1,
        maxCapacity: 8,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'DRAFT',
      },
    });
    ids.experienceId = experience.id;

    // Deterministic flag state whatever a previous run left behind.
    await setFlag('TASTING_SHEET', false);
    await setFlag('GIFT_CARDS', false);
    await setFlag('REQUESTS', false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await setFlag('TASTING_SHEET', false).catch(() => {});
    await setFlag('GIFT_CARDS', false).catch(() => {});
    await setFlag('REQUESTS', false).catch(() => {});
    if (ids.wineryId) {
      await db.emailLog
        .deleteMany({
          where: {
            OR: [
              { wineryId: ids.wineryId },
              { recipientId: ids.wineryId },
              { recipientId: { contains: RUN_TAG } },
            ],
          },
        })
        .catch(() => {});
      await db.booking
        .deleteMany({ where: { wineryId: ids.wineryId } })
        .catch(() => {});
    }
    await db.scheduledJob
      .deleteMany({ where: { dedupeKey: { contains: RUN_TAG } } })
      .catch(() => {});
    if (ids.giftCardId) {
      // The fixture card has NO ledger rows (the append-only trigger makes
      // gift_card_transactions undeletable by design) — plain delete.
      await db.giftCard
        .delete({ where: { id: ids.giftCardId } })
        .catch(() => {});
    }
    if (ids.userId) {
      await db.user.delete({ where: { id: ids.userId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  describe('auth matrix — real verifyCronRequest on all 9 routes', () => {
    it.each(CRON_ROUTES)('$name: no auth header → 401', async ({ load }) => {
      setRequestHeaders();
      const { GET } = await load();
      const res = await GET();
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized' });
    });

    it.each(CRON_ROUTES)(
      '$name: Bearer with a wrong secret → 401',
      async ({ load }) => {
        setRequestHeaders({
          authorization: `Bearer ${'wrong-secret-'.repeat(3)}`,
        });
        const { GET } = await load();
        const res = await GET();
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: 'Unauthorized' });
      }
    );

    it.each(CRON_ROUTES)(
      '$name: Bearer CRON_SECRET → 200, no throw on a quasi-empty base',
      async ({ load }) => {
        setRequestHeaders({ authorization: `Bearer ${CRON_SECRET}` });
        const { GET } = await load();
        const res = await GET();
        // 500 here would mean the handler THREW on an empty base — that
        // no-op resilience is part of the contract under test.
        expect(res.status).toBe(200);
      }
    );

    it.each(CRON_ROUTES)(
      '$name: x-vercel-cron: 1 → 200 (production header path)',
      async ({ load }) => {
        setRequestHeaders({ 'x-vercel-cron': '1' });
        const { GET } = await load();
        const res = await GET();
        expect(res.status).toBe(200);
      }
    );
  });

  describe('reminders — 18h Europe/Zurich guard on the J-1 block', () => {
    it('summer (CEST): 16:00 UTC acts, 12:00 UTC stays inert', async () => {
      const { GET } = await import('@/app/api/cron/reminders/route');
      const emailService = await import('@/server/services/email.service');
      const sendMock = vi.mocked(emailService.sendBookingReminderEmail);
      sendMock.mockClear();

      // CONFIRMED booking on the Zurich day AFTER the faked instant —
      // exactly what the 18h J-1 sweep targets.
      const booking = await makeBooking({
        date: new Date('2026-07-16T00:00:00.000Z'),
        status: BookingStatus.CONFIRMED,
        email: `${RUN_TAG}-cest@test.encave.ch`,
      });
      setRequestHeaders({ authorization: `Bearer ${CRON_SECRET}` });
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        // 12:00 UTC = 14h Zurich — not the reminder hour: no send, no write.
        vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
        let res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
          success: true,
          results: { reminder24h: { sent: 0, failed: 0 } },
        });
        expect(sendMock).not.toHaveBeenCalled();
        let row = await db.booking.findUniqueOrThrow({
          where: { id: booking.id },
          select: { reminder24hSentAt: true },
        });
        expect(row.reminder24hSentAt).toBeNull();

        // 16:00 UTC = 18h CEST (the ?window=cest vercel.json slot): acts.
        vi.setSystemTime(new Date('2026-07-15T16:00:00.000Z'));
        res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
          success: true,
          results: { reminder24h: { sent: 1, failed: 0 } },
        });
        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0]?.[0]).toBe(
          `${RUN_TAG}-cest@test.encave.ch`
        );
        row = await db.booking.findUniqueOrThrow({
          where: { id: booking.id },
          select: { reminder24hSentAt: true },
        });
        expect(row.reminder24hSentAt).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('winter (CET): 17:00 UTC acts, 16:00 UTC stays inert', async () => {
      const { GET } = await import('@/app/api/cron/reminders/route');
      const emailService = await import('@/server/services/email.service');
      const sendMock = vi.mocked(emailService.sendBookingReminderEmail);
      sendMock.mockClear();

      const booking = await makeBooking({
        date: new Date('2026-12-16T00:00:00.000Z'),
        status: BookingStatus.CONFIRMED,
        email: `${RUN_TAG}-cet@test.encave.ch`,
      });
      setRequestHeaders({ authorization: `Bearer ${CRON_SECRET}` });
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        // 16:00 UTC = 17h CET — the cest-window entry firing in winter
        // must be inert (that is the whole point of the double schedule).
        vi.setSystemTime(new Date('2026-12-15T16:00:00.000Z'));
        let res = await GET();
        expect(res.status).toBe(200);
        expect(sendMock).not.toHaveBeenCalled();
        let row = await db.booking.findUniqueOrThrow({
          where: { id: booking.id },
          select: { reminder24hSentAt: true },
        });
        expect(row.reminder24hSentAt).toBeNull();

        // 17:00 UTC = 18h CET (the ?window=cet slot): acts.
        vi.setSystemTime(new Date('2026-12-15T17:00:00.000Z'));
        res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
          results: { reminder24h: { sent: 1, failed: 0 } },
        });
        expect(sendMock).toHaveBeenCalledTimes(1);
        row = await db.booking.findUniqueOrThrow({
          where: { id: booking.id },
          select: { reminder24hSentAt: true },
        });
        expect(row.reminder24hSentAt).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('tasting-sheet-reminder — TASTING_SHEET flag + 21h Zurich guard', () => {
    it('flag OFF wins even at 21h Zurich: explicit flag_off skip', async () => {
      const { GET } =
        await import('@/app/api/cron/tasting-sheet-reminder/route');
      await setFlag('TASTING_SHEET', false);
      setRequestHeaders({ authorization: `Bearer ${CRON_SECRET}` });
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        // 19:00 UTC = 21h CEST — the right hour, but the flag gates first.
        vi.setSystemTime(new Date('2026-07-15T19:00:00.000Z'));
        const res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ skipped: 'flag_off' });
      } finally {
        vi.useRealTimers();
      }
    });

    it('flag ON: only the run matching 21h Zurich acts (CEST and CET)', async () => {
      const { GET } =
        await import('@/app/api/cron/tasting-sheet-reminder/route');
      const emailService = await import('@/server/services/email.service');
      const sendMock = vi.mocked(emailService.sendTastingSheetReminderEmail);
      sendMock.mockClear();
      await setFlag('TASTING_SHEET', true);
      try {
        if (!ids.wineryId) throw new Error('fixture missing');
        // Summer session on the Zurich day 2026-07-15, 10:00 + 90 min —
        // ended hours before the reminder, sheet left empty (no
        // BookingWine rows).
        await makeBooking({
          date: new Date('2026-07-15T00:00:00.000Z'),
          status: BookingStatus.CONFIRMED,
          email: `${RUN_TAG}-sheet-cest@test.encave.ch`,
          timeSlot: '10:00',
        });
        setRequestHeaders({ authorization: `Bearer ${CRON_SECRET}` });
        vi.useFakeTimers({ shouldAdvanceTime: true });

        // 18:00 UTC = 20h CEST (the ?window=cet entry in summer): skipped,
        // nothing sent, nothing logged.
        vi.setSystemTime(new Date('2026-07-15T18:00:00.000Z'));
        let res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          skipped: 'not_local_reminder_hour',
        });
        expect(sendMock).not.toHaveBeenCalled();
        expect(
          await db.emailLog.count({
            where: { type: 'tasting_sheet_reminder', wineryId: ids.wineryId },
          })
        ).toBe(0);

        // 19:00 UTC = 21h CEST: the reminder goes out to the winery.
        vi.setSystemTime(new Date('2026-07-15T19:00:00.000Z'));
        res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
          wineries: 1,
          sent: 1,
          failed: 0,
        });
        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0]?.[0]).toBe(wineryEmail);
        expect(
          await db.emailLog.count({
            where: {
              type: 'tasting_sheet_reminder',
              wineryId: ids.wineryId,
              status: 'sent',
            },
          })
        ).toBe(1);

        // Winter session on the Zurich day 2026-12-15.
        await makeBooking({
          date: new Date('2026-12-15T00:00:00.000Z'),
          status: BookingStatus.CONFIRMED,
          email: `${RUN_TAG}-sheet-cet@test.encave.ch`,
          timeSlot: '10:00',
        });

        // 19:00 UTC = 20h CET (the ?window=cest entry in winter): skipped.
        vi.setSystemTime(new Date('2026-12-15T19:00:00.000Z'));
        res = await GET();
        expect(await res.json()).toEqual({
          skipped: 'not_local_reminder_hour',
        });
        expect(sendMock).toHaveBeenCalledTimes(1);

        // 20:00 UTC = 21h CET: acts on the winter day.
        vi.setSystemTime(new Date('2026-12-15T20:00:00.000Z'));
        res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
          wineries: 1,
          sent: 1,
          failed: 0,
        });
        expect(sendMock).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
        await setFlag('TASTING_SHEET', false);
      }
    });
  });

  describe('process-scheduled-jobs — GIFT_CARDS kill-switch', () => {
    it('flag OFF: a due GIFT_CARD_DELIVERY job is never claimed; ON: delivered', async () => {
      const { GET } =
        await import('@/app/api/cron/process-scheduled-jobs/route');
      const emailService = await import('@/server/services/email.service');
      const sendMock = vi.mocked(emailService.sendGiftCardDeliveryEmail);
      sendMock.mockClear();

      // Real ACTIVE gift card, no ledger rows needed by the delivery
      // handler (and none created — gift_card_transactions is append-only).
      const giftCard = await db.giftCard.create({
        data: {
          code: `${RUN_TAG}GC1`.toUpperCase(),
          status: GiftCardStatus.ACTIVE,
          initialAmount: 5000,
          balance: 5000,
          purchaserEmail: `${RUN_TAG}-purchaser@test.encave.ch`,
          purchaserName: 'Acheteur Cron',
          recipientEmail: `${RUN_TAG}-recipient@test.encave.ch`,
          recipientName: 'Destinataire Cron',
          expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
        },
        select: { id: true },
      });
      ids.giftCardId = giftCard.id;
      const job = await db.scheduledJob.create({
        data: {
          type: GIFT_CARD_DELIVERY_JOB_TYPE,
          runAt: new Date(Date.now() - 60_000),
          payload: { giftCardId: giftCard.id },
          dedupeKey: `${GIFT_CARD_DELIVERY_JOB_TYPE}:${RUN_TAG}`,
        },
        select: { id: true },
      });

      await setFlag('GIFT_CARDS', false);
      await setFlag('TASTING_SHEET', false);
      await setFlag('REQUESTS', false);
      setRequestHeaders({ authorization: `Bearer ${CRON_SECRET}` });

      // Kill-switch OFF: the runner must not even claim the due job —
      // status stays PENDING with 0 attempts consumed (reversible).
      let res = await GET();
      expect(res.status).toBe(200);
      let body = await res.json();
      expect(body).toMatchObject({ claimed: 0, done: 0, failed: 0 });
      expect(body.enabledTypes).not.toContain(GIFT_CARD_DELIVERY_JOB_TYPE);
      let jobRow = await db.scheduledJob.findUniqueOrThrow({
        where: { id: job.id },
        select: { status: true, attempts: true },
      });
      expect(jobRow).toMatchObject({
        status: ScheduledJobStatus.PENDING,
        attempts: 0,
      });
      expect(sendMock).not.toHaveBeenCalled();

      // Kill-switch ON: same GET drains the job to DONE and delivers.
      await setFlag('GIFT_CARDS', true);
      try {
        res = await GET();
        expect(res.status).toBe(200);
        body = await res.json();
        expect(body).toMatchObject({ claimed: 1, done: 1, failed: 0 });
        expect(body.enabledTypes).toEqual([GIFT_CARD_DELIVERY_JOB_TYPE]);
        jobRow = await db.scheduledJob.findUniqueOrThrow({
          where: { id: job.id },
          select: { status: true, attempts: true },
        });
        expect(jobRow).toMatchObject({
          status: ScheduledJobStatus.DONE,
          attempts: 1,
        });
        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0]?.[0]).toBe(
          `${RUN_TAG}-recipient@test.encave.ch`
        );
        const card = await db.giftCard.findUniqueOrThrow({
          where: { id: giftCard.id },
          select: { deliveredAt: true },
        });
        expect(card.deliveredAt).not.toBeNull();
      } finally {
        await setFlag('GIFT_CARDS', false);
      }
    });
  });

  describe('reconcile-gift-transfers — GIFT_CARDS kill-switch', () => {
    it('flag OFF → explicit skip; flag ON on an empty base → zero-scan 200', async () => {
      const { GET } =
        await import('@/app/api/cron/reconcile-gift-transfers/route');
      await setFlag('GIFT_CARDS', false);
      setRequestHeaders({ authorization: `Bearer ${CRON_SECRET}` });

      let res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ skipped: 'flag_off', durationMs: 0 });

      // Flag ON with no gift-funded CONFIRMED booking anywhere: a clean
      // zero-scan run, and Stripe is never touched.
      await setFlag('GIFT_CARDS', true);
      try {
        stripeStub.fns.transfersCreate.mockClear();
        res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
          scanned: 0,
          transferred: 0,
          failed: 0,
        });
        expect(stripeStub.fns.transfersCreate).not.toHaveBeenCalled();
      } finally {
        await setFlag('GIFT_CARDS', false);
      }
    });
  });
});
