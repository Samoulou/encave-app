/**
 * Money recovery paths — verified against a REAL migrated database through
 * the REAL webhook route and services (pre-launch audit, lot 2):
 *
 *  - H3  the expiry webhook never deletes a RE-CLAIMED booking; delete +
 *        gift release are one transaction; a replay still returns the gift;
 *  - M3  `charge.refunded` syncs the refund ledger monotonically, a later
 *        cancellation refunds only the rest; a dispute disables the gift
 *        card bought with the disputed payment;
 *  - 5e  the cancellation claim leaves a crash-recovery marker (real SQL:
 *        append, regexp clear preserving other markers, stuck relabel);
 *  - 5d  the expiry sweep drains oldest-first, page after page, without a
 *        skipped row starving the others;
 *  - M1  the earnings summary (DB aggregation) and the monthly statement
 *        agree with the rule on real rows.
 *
 * Run with:
 *   INVARIANTS_DATABASE_URL=postgresql://... npm run test:db:invariants
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import {
  PrismaClient,
  BookingStatus,
  GiftCardStatus,
  GiftCardTransactionType,
  type Prisma,
} from '@prisma/client';

import {
  buildSignedCheckoutEvent,
  webhookRequest,
  type SignedEvent,
} from './helpers/stripe-webhook-payload';
import { makeStripeStub } from './helpers/stripe-stub';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

const WEBHOOK_SECRET = 'whsec_dbtest_money_recovery_0123456789';
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
delete process.env.E2E_TEST;

const stripeStub = makeStripeStub();
vi.mock('@/server/stripe', () => ({
  isStripeConfigured: () => true,
  getStripe: () => stripeStub.client,
}));

const headerState: { current: Headers } = { current: new Headers() };
vi.mock('next/headers', () => ({
  headers: async () => headerState.current,
}));

vi.mock('@/server/services/email.service', () => ({
  sendBookingConfirmationEmail: vi.fn(async () => true),
  sendWinemakerNewBookingEmail: vi.fn(async () => true),
  sendBookingExpiredEmail: vi.fn(async () => true),
  sendGiftCardPurchaseEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock('@/server/services/giftCard-pdf.service', () => ({
  generateGiftCardPDF: vi.fn(async () => Buffer.from('pdf')),
}));
vi.mock('@/lib/posthog', () => ({ getPostHogServer: () => null }));
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

type CheckoutRoute = typeof import('@/app/api/webhooks/stripe/checkout/route');
type RefundService = typeof import('@/server/services/booking-refund.service');
type ExpirationService =
  typeof import('@/server/services/booking-expiration.service');
type EarningsQueries = typeof import('@/server/queries/earnings.queries');

describe.skipIf(!url)('money recovery paths (audit lot 2)', () => {
  let db: PrismaClient;
  let POST: CheckoutRoute['POST'];
  let refunds: RefundService;
  let expiration: ExpirationService;
  let earnings: EarningsQueries;
  let Sentry: typeof import('@sentry/nextjs');

  const RUN = `mr${Date.now()}`;
  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};
  const eventIds: string[] = [];
  let sequence = 0;

  function fixture(): { wineryId: string; experienceId: string } {
    if (!ids.wineryId || !ids.experienceId) throw new Error('fixture missing');
    return { wineryId: ids.wineryId, experienceId: ids.experienceId };
  }

  async function seedBooking(
    overrides: Partial<Prisma.BookingUncheckedCreateInput> = {}
  ) {
    const { wineryId, experienceId } = fixture();
    sequence += 1;
    return db.booking.create({
      data: {
        reference: `ENC-${RUN.slice(-5)}${String(sequence).padStart(3, '0')}`,
        visitorEmail: `${RUN}-client-${sequence}@test.encave.ch`,
        visitorName: 'Client Recovery',
        visitorPhone: '+41790000006',
        experienceId,
        wineryId,
        date: new Date('2027-06-01T00:00:00.000Z'),
        timeSlot: '10:00',
        guestCount: 2,
        // 2 × 45.00, 10 % commission, 2 × 2.50 client fee.
        totalPrice: 9000,
        serviceFeeCents: 500,
        platformFee: 900,
        wineryPayout: 8100,
        status: BookingStatus.PENDING_PAYMENT,
        ...overrides,
      },
    });
  }

  /** A gift card with `redeemed` cents reserved on `bookingId`. */
  async function seedGiftRedemption(bookingId: string, redeemed: number) {
    sequence += 1;
    const card = await db.giftCard.create({
      data: {
        code: `${RUN}G${sequence}`.toUpperCase(),
        status: GiftCardStatus.ACTIVE,
        initialAmount: 10000,
        balance: 10000 - redeemed,
        purchaserEmail: `${RUN}-purchaser@test.encave.ch`,
        expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
        stripePaymentIntentId: `pi_${RUN}_gift_${sequence}`,
      },
    });
    await db.giftCardTransaction.createMany({
      data: [
        {
          giftCardId: card.id,
          type: GiftCardTransactionType.PURCHASE,
          amount: 10000,
        },
        {
          giftCardId: card.id,
          type: GiftCardTransactionType.REDEMPTION,
          amount: -redeemed,
          bookingId,
          note: 'checkout_redemption',
        },
      ],
    });
    return card;
  }

  function signed(
    input:
      | {
          type: 'checkout.session.expired';
          sessionId: string;
          bookingId: string;
        }
      | { type: string; dataObject: Record<string, unknown> }
  ): SignedEvent {
    const event =
      'dataObject' in input
        ? buildSignedCheckoutEvent({
            type: input.type,
            dataObject: input.dataObject,
            secret: WEBHOOK_SECRET,
          })
        : buildSignedCheckoutEvent({
            type: input.type,
            session: {
              id: input.sessionId,
              metadata: { bookingId: input.bookingId },
              paymentStatus: 'unpaid',
            },
            secret: WEBHOOK_SECRET,
          });
    eventIds.push(event.eventId);
    return event;
  }

  async function post(event: SignedEvent): Promise<number> {
    headerState.current = new Headers({ 'stripe-signature': event.signature });
    const res = await POST(webhookRequest(event));
    return res.status;
  }

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/webhooks/stripe/checkout/route'));
    refunds = await import('@/server/services/booking-refund.service');
    expiration = await import('@/server/services/booking-expiration.service');
    earnings = await import('@/server/queries/earnings.queries');
    Sentry = await import('@sentry/nextjs');
    db = new PrismaClient({ datasourceUrl: url });

    const user = await db.user.create({
      data: { email: `${RUN}-owner@test.encave.ch`, role: 'WINEMAKER' },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Money Recovery Winery ${RUN}`,
        slug: `money-recovery-${RUN}`,
        description: 'Money recovery test fixture',
        address: 'Route du Test 6',
        commune: 'Sion',
        phone: '+41270000006',
        email: `${RUN}-cave@test.encave.ch`,
        userId: user.id,
        status: 'VERIFIED',
        stripeAccountId: `acct_${RUN}`,
        commissionRate: 0.1,
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Money Recovery Experience',
        slug: `money-recovery-${RUN}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 90,
        price: 4500,
        minCapacity: 1,
        maxCapacity: 8,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'PUBLISHED',
      },
    });
    ids.experienceId = experience.id;
  });

  beforeEach(() => {
    vi.mocked(Sentry.captureMessage).mockClear();
    stripeStub.fns.sessionsRetrieve.mockClear();
    stripeStub.fns.refundsCreate.mockClear();
  });

  afterAll(async () => {
    // Gift ledger is append-only (DB trigger): cards and movements stay
    // (codes / payment intents are unique per run). Everything else goes.
    await db.stripeEvent
      .deleteMany({ where: { stripeEventId: { in: eventIds } } })
      .catch(() => {});
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

  // ───────────────────────────── H3 ─────────────────────────────

  describe('H3 — checkout.session.expired vs a re-claimed booking', () => {
    it('keeps a booking whose hold was just extended by a retry (still pointing at the expired session)', async () => {
      const sessionId = `cs_${RUN}_reclaimed`;
      const booking = await seedBooking({
        stripeCheckoutSessionId: sessionId,
        // The re-claim pushed the hold 30 min ahead and expired the old
        // session; the new session id is not written yet.
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      const card = await seedGiftRedemption(booking.id, 5000);

      const status = await post(
        signed({
          type: 'checkout.session.expired',
          sessionId,
          bookingId: booking.id,
        })
      );

      expect(status).toBe(200);
      const row = await db.booking.findUnique({ where: { id: booking.id } });
      expect(row?.status).toBe(BookingStatus.PENDING_PAYMENT);
      // The gift stays reserved for the retry — nothing released.
      const gift = await db.giftCard.findUniqueOrThrow({
        where: { id: card.id },
      });
      expect(gift.balance).toBe(5000);
    });

    it('deletes a naturally expired booking AND returns its reserved gift — one transaction', async () => {
      const sessionId = `cs_${RUN}_natural`;
      const booking = await seedBooking({
        stripeCheckoutSessionId: sessionId,
        expiresAt: new Date(Date.now() - 60_000),
      });
      const card = await seedGiftRedemption(booking.id, 5000);

      const status = await post(
        signed({
          type: 'checkout.session.expired',
          sessionId,
          bookingId: booking.id,
        })
      );

      expect(status).toBe(200);
      expect(
        await db.booking.findUnique({ where: { id: booking.id } })
      ).toBeNull();
      const gift = await db.giftCard.findUniqueOrThrow({
        where: { id: card.id },
      });
      expect(gift.balance).toBe(10000);
      const movements = await db.giftCardTransaction.findMany({
        where: { bookingId: booking.id },
        select: { type: true, amount: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(movements).toEqual([
        { type: GiftCardTransactionType.REDEMPTION, amount: -5000 },
        { type: GiftCardTransactionType.REFUND, amount: 5000 },
      ]);
    });

    it('REPLAY: the booking is already gone but its redemption is still reserved → released, exactly once', async () => {
      // The state the old two-statement handler could leave behind: row
      // deleted, release never ran.
      const sessionId = `cs_${RUN}_replay`;
      const booking = await seedBooking({
        stripeCheckoutSessionId: sessionId,
        expiresAt: new Date(Date.now() - 60_000),
      });
      const card = await seedGiftRedemption(booking.id, 5000);
      await db.booking.delete({ where: { id: booking.id } });

      const first = await post(
        signed({
          type: 'checkout.session.expired',
          sessionId,
          bookingId: booking.id,
        })
      );
      const second = await post(
        signed({
          type: 'checkout.session.expired',
          sessionId,
          bookingId: booking.id,
        })
      );

      expect([first, second]).toEqual([200, 200]);
      const gift = await db.giftCard.findUniqueOrThrow({
        where: { id: card.id },
      });
      expect(gift.balance).toBe(10000); // never 15000
    });
  });

  // ───────────────────────────── M3 ─────────────────────────────

  describe('M3 — refunds and disputes that happen outside the app', () => {
    it('charge.refunded raises refundAmount to Stripe truth, never lowers it; the later cancellation refunds only the rest', async () => {
      const paymentIntentId = `pi_${RUN}_dashboard`;
      const booking = await seedBooking({
        status: BookingStatus.CONFIRMED,
        stripePaymentIntentId: paymentIntentId,
      });
      const refundedEvent = (amountRefunded: number) =>
        signed({
          type: 'charge.refunded',
          dataObject: {
            id: `ch_${RUN}_dashboard`,
            object: 'charge',
            payment_intent: paymentIntentId,
            amount: 9500,
            amount_refunded: amountRefunded,
            refunded: amountRefunded >= 9500,
          },
        });

      // A 20.00 goodwill refund issued from the Stripe Dashboard.
      expect(await post(refundedEvent(2000))).toBe(200);
      let row = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { refundAmount: true, refundIssued: true, status: true },
      });
      expect(row).toEqual({
        refundAmount: 2000,
        refundIssued: true,
        status: BookingStatus.CONFIRMED,
      });

      // A late / out-of-order event with a LOWER cumulative amount.
      expect(await post(refundedEvent(1000))).toBe(200);
      row = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { refundAmount: true, refundIssued: true, status: true },
      });
      expect(row.refundAmount).toBe(2000);

      // The cancellation path now sees 20.00 already returned: a full-refund
      // policy owes 95.00 − 20.00 = 75.00, not 95.00 again.
      const { computeBookingRefund } =
        await import('@/lib/business-rules/cancellation-policy');
      const due = computeBookingRefund(
        {
          totalPrice: 9000,
          serviceFeeCents: 500,
          refundAmount: row.refundAmount,
          cancellationPolicy: 'STANDARD',
          winery: { cancellationPolicy: 'STANDARD' },
        },
        72
      );
      expect(due.refundDueCents).toBe(7500);
    });

    it('a cancellation whose ledger never heard of a Dashboard refund still succeeds — Stripe is asked, only the rest is refunded', async () => {
      const paymentIntentId = `pi_${RUN}_drift`;
      const booking = await seedBooking({
        status: BookingStatus.CANCELLED_BY_CLIENT,
        stripePaymentIntentId: paymentIntentId,
      });
      const invalid = Object.assign(new Error('greater than unrefunded'), {
        type: 'StripeInvalidRequestError',
      });
      stripeStub.fns.refundsCreate
        .mockRejectedValueOnce(invalid)
        .mockResolvedValueOnce({
          id: `re_${RUN}_rest`,
          status: 'succeeded',
          amount: 7500,
        } as never);
      stripeStub.fns.refundsList.mockResolvedValueOnce({
        data: [{ amount: 2000, status: 'succeeded' }],
      });

      const outcome = await refunds.processCancellationRefund({
        bookingId: booking.id,
        stripePaymentIntentId: paymentIntentId,
        giftAppliedCents: 0,
        wineryPayout: 8100,
        refundDueCents: 9500,
        alreadyRefundedCents: 0,
        paidCents: 9500,
        reversalCents: 8100,
        actionName: 'cancelBooking',
      });
      await refunds.recordCancellationRefund({
        bookingId: booking.id,
        readRefundAmount: null,
        outcome,
        actionName: 'cancelBooking',
      });

      expect(stripeStub.fns.refundsCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payment_intent: paymentIntentId,
          amount: 7500,
        }),
        expect.anything()
      );
      const row = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { refundAmount: true, refundIssued: true, refundError: true },
      });
      // 20.00 (Dashboard) + 75.00 (this cancellation) = everything paid.
      expect(row.refundAmount).toBe(9500);
      expect(row.refundIssued).toBe(true);
      expect(row.refundError).toContain('STRIPE_REFUND_DRIFT');
    });

    it('charge.dispute.created disables the gift card bought with the disputed payment (balance + ledger untouched) and alerts', async () => {
      const placeholder = await seedBooking();
      const card = await seedGiftRedemption(placeholder.id, 6000);
      const paymentIntentId = card.stripePaymentIntentId;

      const status = await post(
        signed({
          type: 'charge.dispute.created',
          dataObject: {
            id: `dp_${RUN}_gift`,
            object: 'dispute',
            status: 'needs_response',
            reason: 'fraudulent',
            amount: 10250,
            payment_intent: paymentIntentId,
          },
        })
      );

      expect(status).toBe(200);
      const gift = await db.giftCard.findUniqueOrThrow({
        where: { id: card.id },
      });
      expect(gift.status).toBe(GiftCardStatus.DISABLED);
      expect(gift.balance).toBe(4000);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tags: {
            area: 'stripe-webhook',
            incident: 'dispute',
            target: 'gift-card',
          },
          extra: expect.objectContaining({ redeemedCents: 6000 }),
        })
      );
    });

    it('charge.dispute.created on a booking changes nothing on it and alerts with its reference', async () => {
      const paymentIntentId = `pi_${RUN}_disputed_booking`;
      const booking = await seedBooking({
        status: BookingStatus.COMPLETED,
        stripePaymentIntentId: paymentIntentId,
      });

      const status = await post(
        signed({
          type: 'charge.dispute.created',
          dataObject: {
            id: `dp_${RUN}_booking`,
            object: 'dispute',
            status: 'needs_response',
            reason: 'product_not_received',
            amount: 9500,
            payment_intent: paymentIntentId,
          },
        })
      );

      expect(status).toBe(200);
      const row = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { status: true, refundAmount: true, refundError: true },
      });
      expect(row).toEqual({
        status: BookingStatus.COMPLETED,
        refundAmount: null,
        refundError: null,
      });
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tags: {
            area: 'stripe-webhook',
            incident: 'dispute',
            target: 'booking',
          },
          extra: expect.objectContaining({ bookingRef: booking.reference }),
        })
      );
    });
  });

  // ───────────────────────────── 5e ─────────────────────────────

  describe('5e — cancellation claim leaves a crash-recovery marker', () => {
    it('claim + marker are atomic; the marker is cleared without touching the other markers', async () => {
      const booking = await seedBooking({
        status: BookingStatus.CONFIRMED,
        refundError: 'EARLIER_MARKER: kept',
      });

      const claimed = await refunds.claimBookingCancellation({
        bookingId: booking.id,
        from: BookingStatus.CONFIRMED,
        to: BookingStatus.CANCELLED_BY_CLIENT,
        refundDueCents: 9500,
      });
      expect(claimed).toBe(true);
      // Exactly what a crash right here would leave behind.
      let row = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { status: true, refundError: true, cancelledAt: true },
      });
      expect(row.status).toBe(BookingStatus.CANCELLED_BY_CLIENT);
      expect(row.refundError).toBe(
        'EARLIER_MARKER: kept | CANCEL_REFUND_PENDING(9500)'
      );

      // A second claim loses and writes no second marker.
      expect(
        await refunds.claimBookingCancellation({
          bookingId: booking.id,
          from: BookingStatus.CONFIRMED,
          to: BookingStatus.CANCELLED_BY_CLIENT,
          refundDueCents: 9500,
        })
      ).toBe(false);

      await refunds.appendRefundError(booking.id, 'LATER_MARKER: kept too');
      await refunds.clearCancellationRefundMarker(booking.id, 9500);
      row = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { status: true, refundError: true, cancelledAt: true },
      });
      expect(row.refundError).toBe(
        'EARLIER_MARKER: kept | LATER_MARKER: kept too'
      );
    });

    it('a marker alone is cleared to NULL', async () => {
      const booking = await seedBooking({ status: BookingStatus.CONFIRMED });
      await refunds.claimBookingCancellation({
        bookingId: booking.id,
        from: BookingStatus.CONFIRMED,
        to: BookingStatus.CANCELLED_BY_CLIENT,
        refundDueCents: 4750,
      });

      await refunds.clearCancellationRefundMarker(booking.id);

      const row = await db.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { refundError: true },
      });
      expect(row.refundError).toBeNull();
    });

    it('the sweep alerts ONCE on a marker left by a crash and relabels it STUCK; a fresh one is left alone', async () => {
      const crashed = await seedBooking({ status: BookingStatus.CONFIRMED });
      const inFlight = await seedBooking({ status: BookingStatus.CONFIRMED });
      for (const booking of [crashed, inFlight]) {
        await refunds.claimBookingCancellation({
          bookingId: booking.id,
          from: BookingStatus.CONFIRMED,
          to: BookingStatus.CANCELLED_BY_CLIENT,
          refundDueCents: 9500,
        });
      }
      // The crashed one was claimed an hour ago and never finished.
      await db.booking.update({
        where: { id: crashed.id },
        data: { cancelledAt: new Date(Date.now() - 60 * 60 * 1000) },
      });

      const firstPass = await refunds.flagStuckCancellationRefunds();
      const secondPass = await refunds.flagStuckCancellationRefunds();

      expect(firstPass).toBeGreaterThanOrEqual(1);
      const rows = await db.booking.findMany({
        where: { id: { in: [crashed.id, inFlight.id] } },
        select: { id: true, refundError: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r.refundError]));
      expect(byId.get(crashed.id)).toBe('CANCEL_REFUND_STUCK(9500)');
      expect(byId.get(inFlight.id)).toBe('CANCEL_REFUND_PENDING(9500)');
      const alertsForCrashed = vi
        .mocked(Sentry.captureMessage)
        .mock.calls.filter(
          (call) =>
            (call[1] as { extra?: { bookingId?: string } } | undefined)?.extra
              ?.bookingId === crashed.id
        );
      expect(alertsForCrashed).toHaveLength(1);
      // Already relabelled: not picked up again.
      expect(secondPass).toBeLessThan(firstPass + 1);
      await refunds.clearCancellationRefundMarker(inFlight.id);
      await refunds.clearCancellationRefundMarker(crashed.id);
    });
  });

  // ───────────────────────────── 5d ─────────────────────────────

  describe('5d — expiry sweep', () => {
    it('drains oldest first, page after page; a row it must skip (paid session) never starves the others', async () => {
      const now = new Date();
      const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);
      // Oldest: PAID at Stripe but still pending → the sweep must leave it.
      const paid = await seedBooking({
        stripeCheckoutSessionId: `cs_${RUN}_paid_pending`,
        expiresAt: minutesAgo(600),
      });
      const expiredA = await seedBooking({ expiresAt: minutesAgo(50) });
      const expiredB = await seedBooking({ expiresAt: minutesAgo(40) });
      const expiredC = await seedBooking({ expiresAt: minutesAgo(30) });
      const alive = await seedBooking({
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      });
      const giftCard = await seedGiftRedemption(expiredB.id, 3000);
      stripeStub.fns.sessionsRetrieve.mockImplementation(async (id: string) =>
        id === `cs_${RUN}_paid_pending`
          ? { id, payment_status: 'paid', status: 'complete' }
          : { id, payment_status: 'unpaid', status: 'open' }
      );

      // batchSize 2: the skipped row sits in the FIRST page of every query.
      const result = await expiration.expirePendingPaymentBookings(now, {
        batchSize: 2,
      });

      expect(result.budgetExhausted).toBe(false);
      expect(result.failed).toBe(0);
      const rows = await db.booking.findMany({
        where: {
          id: {
            in: [paid.id, expiredA.id, expiredB.id, expiredC.id, alive.id],
          },
        },
        select: { id: true, status: true, cancellationReason: true },
      });
      const statusOf = (id: string) => rows.find((r) => r.id === id)?.status;
      expect(statusOf(paid.id)).toBe(BookingStatus.PENDING_PAYMENT);
      expect(statusOf(alive.id)).toBe(BookingStatus.PENDING_PAYMENT);
      for (const id of [expiredA.id, expiredB.id, expiredC.id]) {
        expect(statusOf(id)).toBe(BookingStatus.CANCELLED_BY_CLIENT);
      }
      // Cancellation + gift release were one transaction.
      const gift = await db.giftCard.findUniqueOrThrow({
        where: { id: giftCard.id },
      });
      expect(gift.balance).toBe(10000);
      // Paid, still pending 10 h after its window closed: the lost-webhook
      // alert fires (client charged, no ticket).
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'paid checkout session, booking still pending',
        expect.objectContaining({
          tags: { area: 'stripe-webhook', incident: 'paid-pending' },
          extra: expect.objectContaining({ bookingId: paid.id }),
        })
      );
      await db.booking.delete({ where: { id: paid.id } });
    });

    it('stops at its time budget and says so', async () => {
      await seedBooking({ expiresAt: new Date(Date.now() - 60_000) });

      const result = await expiration.expirePendingPaymentBookings(new Date(), {
        budgetMs: 0,
      });

      expect(result).toMatchObject({ budgetExhausted: true, expired: 0 });
    });
  });

  // ───────────────────────────── M1 ─────────────────────────────

  describe('M1 — earnings on real rows', () => {
    it('summary (DB aggregation) and monthly statement apply the same rule', async () => {
      const { wineryId } = fixture();
      await db.booking.deleteMany({ where: { wineryId } });
      const now = new Date();
      const month = now.toISOString().slice(0, 7);
      // A day of the current month that is not in the future.
      const day = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      );

      // 1. paid online, kept in full                    net 81.00
      await seedBooking({
        date: day,
        status: BookingStatus.COMPLETED,
        stripePaymentIntentId: `pi_${RUN}_m1_a`,
      });
      // 2. NO_SHOW paid online — money kept             net 81.00
      await seedBooking({
        date: day,
        status: BookingStatus.NO_SHOW,
        stripePaymentIntentId: `pi_${RUN}_m1_b`,
      });
      // 3. ON_SITE — volume only                        net 0
      await seedBooking({ date: day, status: BookingStatus.COMPLETED });
      // 4. late client cancellation, nothing refunded   net 81.00
      await seedBooking({
        date: day,
        status: BookingStatus.CANCELLED_BY_CLIENT,
        stripePaymentIntentId: `pi_${RUN}_m1_d`,
      });
      // 5. partial ADMIN refund (refundIssued false): half → net 40.50
      await seedBooking({
        date: day,
        status: BookingStatus.COMPLETED,
        stripePaymentIntentId: `pi_${RUN}_m1_e`,
        refundAmount: 4750,
        refundIssued: false,
      });
      // 6. fully refunded winery cancellation           net 0, not listed
      await seedBooking({
        date: day,
        status: BookingStatus.CANCELLED_BY_WINERY,
        stripePaymentIntentId: `pi_${RUN}_m1_f`,
        refundAmount: 9500,
        refundIssued: true,
      });
      // 7. abandoned checkout (expired pending)         nothing
      await seedBooking({
        date: day,
        status: BookingStatus.CANCELLED_BY_CLIENT,
        cancellationReason: 'PAYMENT_EXPIRED',
      });

      const summary = await earnings.getEarningsSummary(wineryId);
      const statement = await earnings.getMonthlyStatementData(wineryId, month);

      const expectedNet = 8100 + 8100 + 8100 + 4050;
      expect(summary.thisMonth).toBe(expectedNet);
      expect(summary.totalEarnings).toBe(expectedNet);
      // Gross kept: 3 × 90.00 + half of 90.00.
      expect(summary.yearToDate).toBe(9000 * 3 + 4500);

      expect(statement).toMatchObject({
        grossCents: 9000 * 4,
        commissionCents: 900 * 3 + 450,
        refundedCents: 4500,
        netCents: expectedNet,
      });
      // Listed: the four money rows + the ON_SITE one (volume).
      expect(statement?.lines).toHaveLength(5);
      expect(statement?.lines.filter((line) => line.onSite)).toHaveLength(1);
      expect(
        (statement?.grossCents ?? 0) -
          (statement?.commissionCents ?? 0) -
          (statement?.refundedCents ?? 0)
      ).toBe(statement?.netCents);
    });
  });
});
