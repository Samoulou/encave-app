/**
 * P0 lot 1 (pre-launch test plan) — the REAL checkout webhook handler
 * (`POST /api/webhooks/stripe/checkout`) against a REAL migrated database,
 * driven by synthetic Stripe events SIGNED with the same secret the route
 * verifies (`stripe.webhooks.constructEvent` runs for real). First
 * route-level coverage of the webhook→DB path outside e2e.
 *
 * Covers: nominal confirmation, StripeEvent idempotency (redelivery,
 * FAILED→retry, concurrent double delivery), gift-card minting, request
 * offer flip, session expiry (nominal / stale session / non-pending),
 * signature guards, unknown event types, and the gift settle dispatch.
 *
 * Run with:
 *   INVARIANTS_DATABASE_URL=postgresql://... npx vitest run tests/db
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { addHours } from 'date-fns';
import {
  PrismaClient,
  BookingStatus,
  GiftCardStatus,
  GiftCardTransactionType,
  Prisma,
  RequestOfferStatus,
  RequestStatus,
  ScheduledJobStatus,
} from '@prisma/client';

import {
  buildSignedCheckoutEvent,
  webhookRequest,
  type CheckoutEventType,
  type SignedEvent,
  type SyntheticSession,
} from './helpers/stripe-webhook-payload';
import { makeStripeStub } from './helpers/stripe-stub';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

// The route reads env.STRIPE_WEBHOOK_SECRET (Zod, import-time) — set it
// BEFORE any dynamic import of app code, and sign with the SAME value.
const WEBHOOK_SECRET = 'whsec_dbtest_0123456789abcdef';
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

// Real signature crypto + vi.fn network surface (no Stripe network access).
const stripeStub = makeStripeStub();
vi.mock('@/server/stripe', () => ({
  isStripeConfigured: () => true,
  getStripe: () => stripeStub.client,
}));

// The route reads the signature via next/headers (request context), NOT
// req.headers — mutable state posed before each POST. A concurrent double
// POST of the SAME event shares the same signature, so one state suffices.
const headerState: { current: Headers } = { current: new Headers() };
vi.mock('next/headers', () => ({
  headers: async () => headerState.current,
}));

// Observable, deterministic sends (count = deliveries). Only the exports
// the route's import graph actually pulls need to exist here.
vi.mock('@/server/services/email.service', () => ({
  sendBookingConfirmationEmail: vi.fn(async () => true),
  sendWinemakerNewBookingEmail: vi.fn(async () => true),
  sendGiftCardPurchaseEmail: vi.fn(async () => ({
    ok: true,
    messageId: `msg_${Math.random().toString(36).slice(2)}`,
  })),
}));

// @react-pdf/renderer is heavy and irrelevant here — the purchaser email
// (mocked above) is the only consumer of the PDF.
vi.mock('@/server/services/giftCard-pdf.service', () => ({
  generateGiftCardPDF: vi.fn(async () => Buffer.from('pdf')),
}));

// The confirmation service captures analytics — keep it out of the way.
vi.mock('@/lib/posthog', () => ({
  getPostHogServer: () => null,
}));

// stripe-event.service + giftCard-transfer.service import Sentry.
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

type CheckoutRoute = typeof import('@/app/api/webhooks/stripe/checkout/route');
type EmailService = typeof import('@/server/services/email.service');

describe.skipIf(!url)('checkout webhook route (P0 lot 1)', () => {
  let db: PrismaClient;
  let POST: CheckoutRoute['POST'];
  let emails: EmailService;

  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};
  const eventIds: string[] = [];
  const jobIds: string[] = [];
  const requestIds: string[] = [];

  // Shared by the redelivery / FAILED-retry tests (file runs sequentially).
  let nominalBookingId: string;
  let nominalEvent: SignedEvent;

  /** Signed event whose StripeEvent row is tracked for cleanup. */
  function signedEvent(input: {
    type: CheckoutEventType;
    session: SyntheticSession;
    eventId?: string;
  }): SignedEvent {
    const event = buildSignedCheckoutEvent({
      ...input,
      secret: WEBHOOK_SECRET,
    });
    eventIds.push(event.eventId);
    return event;
  }

  /** POST one signed event through the REAL route handler. */
  async function post(
    event: SignedEvent
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    headerState.current = new Headers({ 'stripe-signature': event.signature });
    const res = await POST(webhookRequest(event));
    const body = (await res.json()) as Record<string, unknown>;
    return { status: res.status, body };
  }

  /**
   * PENDING_PAYMENT booking pointing at its own synthetic session
   * (`dbtest_sess_{bookingId}` — the helper's default for a session whose
   * metadata carries the bookingId), unless the caller overrides it.
   */
  async function seedBooking(
    overrides: Partial<Prisma.BookingUncheckedCreateInput> = {}
  ): Promise<{ id: string; sessionId: string }> {
    if (!ids.experienceId || !ids.wineryId) throw new Error('fixture missing');
    const created = await db.booking.create({
      data: {
        reference: `ENC-WH${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        visitorEmail: `client-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}@test.encave.ch`,
        visitorName: 'Client Webhook',
        visitorPhone: '+41790000002',
        experienceId: ids.experienceId,
        wineryId: ids.wineryId,
        date: new Date('2027-05-01T00:00:00.000Z'),
        timeSlot: '10:00',
        guestCount: 2,
        totalPrice: 5000,
        platformFee: 600,
        wineryPayout: 4400,
        status: BookingStatus.PENDING_PAYMENT,
        ...overrides,
      },
      select: { id: true, stripeCheckoutSessionId: true },
    });
    const sessionId =
      created.stripeCheckoutSessionId ?? `dbtest_sess_${created.id}`;
    if (!created.stripeCheckoutSessionId) {
      await db.booking.update({
        where: { id: created.id },
        data: { stripeCheckoutSessionId: sessionId },
      });
    }
    return { id: created.id, sessionId };
  }

  beforeAll(async () => {
    ({ POST } = await import('@/app/api/webhooks/stripe/checkout/route'));
    emails = await import('@/server/services/email.service');
    db = new PrismaClient({ datasourceUrl: url });

    const user = await db.user.create({
      data: {
        email: `webhook-route-${Date.now()}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Webhook Route Winery ${Date.now()}`,
        slug: `webhook-route-${Date.now()}`,
        description: 'Webhook route test fixture',
        address: 'Route du Test 9',
        commune: 'Sion',
        phone: '+41270000009',
        email: 'webhook-route@test.encave.ch',
        userId: user.id,
        status: 'VERIFIED',
        // The gift settle dispatch needs a Connect destination.
        stripeAccountId: `acct_dbtest_${Date.now()}`,
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Webhook Route Experience',
        slug: `webhook-route-${Date.now()}`,
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
  });

  afterAll(async () => {
    // Gift ledger is append-only (DB trigger) and cards are Restrict-linked
    // to their transactions: cards/movements stay (codes and payment
    // intents are unique per run). Everything else is removed.
    await db.scheduledJob
      .deleteMany({ where: { id: { in: jobIds } } })
      .catch(() => {});
    await db.stripeEvent
      .deleteMany({ where: { stripeEventId: { in: eventIds } } })
      .catch(() => {});
    await db.request
      .deleteMany({ where: { id: { in: requestIds } } })
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

  it('confirms a PENDING_PAYMENT booking on checkout.session.completed', async () => {
    const confirmMock = vi.mocked(emails.sendBookingConfirmationEmail);
    const wineryMock = vi.mocked(emails.sendWinemakerNewBookingEmail);
    confirmMock.mockClear();
    wineryMock.mockClear();

    const booking = await seedBooking();
    nominalBookingId = booking.id;
    nominalEvent = signedEvent({
      type: 'checkout.session.completed',
      session: { metadata: { bookingId: booking.id } },
    });

    const { status, body } = await post(nominalEvent);
    expect(status).toBe(200);
    expect(body).toEqual({ received: true });

    const row = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: {
        status: true,
        stripeCheckoutSessionId: true,
        stripePaymentIntentId: true,
        accessTokenHash: true,
        expiresAt: true,
        confirmationSentAt: true,
        wineryNotifiedAt: true,
      },
    });
    expect(row.status).toBe(BookingStatus.CONFIRMED);
    expect(row.stripeCheckoutSessionId).toBe(booking.sessionId);
    expect(row.stripePaymentIntentId).toBe(`pi_dbtest_${booking.id}`);
    expect(row.accessTokenHash).not.toBeNull();
    expect(row.expiresAt).toBeNull();
    expect(row.confirmationSentAt).not.toBeNull();
    expect(row.wineryNotifiedAt).not.toBeNull();

    const stripeEvent = await db.stripeEvent.findUniqueOrThrow({
      where: { stripeEventId: nominalEvent.eventId },
      select: { status: true, type: true },
    });
    expect(stripeEvent).toEqual({
      status: 'PROCESSED',
      type: 'checkout.session.completed',
    });

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(wineryMock).toHaveBeenCalledTimes(1);
  });

  it('redelivery of the same event id is a duplicate no-op', async () => {
    const confirmMock = vi.mocked(emails.sendBookingConfirmationEmail);
    confirmMock.mockClear();

    const { status, body } = await post(nominalEvent);
    expect(status).toBe(200);
    expect(body).toEqual({ received: true, duplicate: true });

    // No double effect: zero additional sends, booking untouched.
    expect(confirmMock).not.toHaveBeenCalled();
    const row = await db.booking.findUniqueOrThrow({
      where: { id: nominalBookingId },
      select: { status: true },
    });
    expect(row.status).toBe(BookingStatus.CONFIRMED);
  });

  it('a FAILED event is re-claimed and reprocessed on redelivery', async () => {
    const confirmMock = vi.mocked(emails.sendBookingConfirmationEmail);
    confirmMock.mockClear();

    await db.stripeEvent.update({
      where: { stripeEventId: nominalEvent.eventId },
      data: { status: 'FAILED', errorMessage: 'boom (manual)' },
    });

    const { status, body } = await post(nominalEvent);
    expect(status).toBe(200);
    // NOT flagged duplicate: the FAILED row was re-claimed and reprocessed.
    expect(body).toEqual({ received: true });

    const stripeEvent = await db.stripeEvent.findUniqueOrThrow({
      where: { stripeEventId: nominalEvent.eventId },
      select: { status: true, errorMessage: true },
    });
    expect(stripeEvent).toEqual({ status: 'PROCESSED', errorMessage: null });

    // Reprocessing an already-CONFIRMED booking sends nothing again.
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('two concurrent POSTs of the same event process exactly once, both 2xx', async () => {
    const confirmMock = vi.mocked(emails.sendBookingConfirmationEmail);
    confirmMock.mockClear();

    const booking = await seedBooking();
    const event = signedEvent({
      type: 'checkout.session.completed',
      session: { metadata: { bookingId: booking.id } },
    });

    // Same event → same signature: one header state serves both requests.
    headerState.current = new Headers({ 'stripe-signature': event.signature });
    const [resA, resB] = await Promise.all([
      POST(webhookRequest(event)),
      POST(webhookRequest(event)),
    ]);
    const bodyA = (await resA.json()) as Record<string, unknown>;
    const bodyB = (await resB.json()) as Record<string, unknown>;

    // Never a 500 on a duplicate — Stripe would retry-storm.
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    const duplicates = [bodyA, bodyB].filter((b) => b.duplicate === true);
    expect(duplicates).toHaveLength(1);

    // Exactly one processing: one confirmation email, booking CONFIRMED.
    expect(confirmMock).toHaveBeenCalledTimes(1);
    const row = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { status: true },
    });
    expect(row.status).toBe(BookingStatus.CONFIRMED);
    const stripeEvent = await db.stripeEvent.findUniqueOrThrow({
      where: { stripeEventId: event.eventId },
      select: { status: true },
    });
    expect(stripeEvent.status).toBe('PROCESSED');
  });

  it('mints a gift card once (ledger + delivery job), redelivery-proof', async () => {
    const purchaseMock = vi.mocked(emails.sendGiftCardPurchaseEmail);
    purchaseMock.mockClear();

    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const paymentIntentId = `pi_dbtest_gift_${stamp}`;
    // Metadata format of tests/e2e/utils/stripe-webhook.ts::mintGiftCardViaWebhook.
    const session: SyntheticSession = {
      id: `dbtest_sess_gift_${stamp}`,
      paymentIntentId,
      customerEmail: `purchaser-${stamp}@test.encave.ch`,
      metadata: {
        kind: 'gift_card',
        nature: 'AMOUNT',
        amountCents: '7500',
        recipientEmail: `recipient-${stamp}@test.encave.ch`,
        purchaserName: 'Sam Acheteur',
        deliverAt: new Date().toISOString(),
        variant: 'NEUTRE',
        locale: 'fr',
      },
    };

    const event = signedEvent({
      type: 'checkout.session.completed',
      session,
    });
    const first = await post(event);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ received: true });

    const card = await db.giftCard.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { transactions: true },
    });
    if (!card) throw new Error('gift card was not minted');
    expect(card.status).toBe(GiftCardStatus.ACTIVE);
    expect(card.initialAmount).toBe(7500);
    expect(card.balance).toBe(7500);
    expect(card.recipientEmail).toBe(`recipient-${stamp}@test.encave.ch`);
    expect(card.transactions).toHaveLength(1);
    expect(card.transactions[0]).toMatchObject({
      type: GiftCardTransactionType.PURCHASE,
      amount: 7500,
    });

    // Recipient delivery job armed. NOTE: the service creates it WITHOUT a
    // dedupeKey (idempotence rides the stripePaymentIntentId guard on the
    // card itself) — asserted as-built, flagged in the QA report.
    const jobs = await db.scheduledJob.findMany({
      where: {
        type: 'GIFT_CARD_DELIVERY',
        payload: { path: ['giftCardId'], equals: card.id },
      },
      select: { id: true, status: true },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe(ScheduledJobStatus.PENDING);
    jobIds.push(...jobs.map((j) => j.id));

    expect(purchaseMock).toHaveBeenCalledTimes(1);

    // Redelivery, same event id → StripeEvent guard, nothing minted.
    const again = await post(event);
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ received: true, duplicate: true });

    // Fresh event id, SAME session/payment intent → the card-level
    // idempotency guard (stripePaymentIntentId) holds too.
    const replay = signedEvent({
      type: 'checkout.session.completed',
      session,
    });
    const replayed = await post(replay);
    expect(replayed.status).toBe(200);
    expect(replayed.body).toEqual({ received: true });

    const cardCount = await db.giftCard.count({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    expect(cardCount).toBe(1);
    const jobCount = await db.scheduledJob.count({
      where: {
        type: 'GIFT_CARD_DELIVERY',
        payload: { path: ['giftCardId'], equals: card.id },
      },
    });
    expect(jobCount).toBe(1);
    // Still one purchaser email across all three deliveries.
    expect(purchaseMock).toHaveBeenCalledTimes(1);
  });

  it('request offer payment confirms the booking and flips offer+request to PAID', async () => {
    const booking = await seedBooking();
    const request = await db.request.create({
      data: {
        reference: `REQ-WH${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        status: RequestStatus.OFFERED,
        wineryId: ids.wineryId,
        clientEmail: `demande-${Date.now()}@test.encave.ch`,
        clientName: 'Client Demande',
        guestCount: 4,
        description: 'Visite sur-mesure de test',
      },
      select: { id: true },
    });
    requestIds.push(request.id);
    const offer = await db.requestOffer.create({
      data: {
        requestId: request.id,
        status: RequestOfferStatus.SENT,
        message: 'Offre de test',
        totalPrice: 5000,
        expiresAt: addHours(new Date(), 24),
        bookingId: booking.id,
      },
      select: { id: true },
    });

    const event = signedEvent({
      type: 'checkout.session.completed',
      session: {
        metadata: {
          bookingId: booking.id,
          kind: 'request_offer',
          requestOfferId: offer.id,
        },
      },
    });
    const { status, body } = await post(event);
    expect(status).toBe(200);
    expect(body).toEqual({ received: true });

    const [bookingRow, offerRow, requestRow] = await Promise.all([
      db.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { status: true },
      }),
      db.requestOffer.findUniqueOrThrow({
        where: { id: offer.id },
        select: { status: true },
      }),
      db.request.findUniqueOrThrow({
        where: { id: request.id },
        select: { status: true },
      }),
    ]);
    expect(bookingRow.status).toBe(BookingStatus.CONFIRMED);
    expect(offerRow.status).toBe(RequestOfferStatus.PAID);
    expect(requestRow.status).toBe(RequestStatus.PAID);
  });

  it('expiry of the pointed session deletes the pending booking', async () => {
    const booking = await seedBooking();
    const event = signedEvent({
      type: 'checkout.session.expired',
      // Helper default session id = dbtest_sess_{bookingId} = the session
      // the booking points at.
      session: { metadata: { bookingId: booking.id } },
    });

    const { status, body } = await post(event);
    expect(status).toBe(200);
    expect(body).toEqual({ received: true });

    const row = await db.booking.findUnique({ where: { id: booking.id } });
    expect(row).toBeNull();
    const stripeEvent = await db.stripeEvent.findUniqueOrThrow({
      where: { stripeEventId: event.eventId },
      select: { status: true },
    });
    expect(stripeEvent.status).toBe('PROCESSED');
  });

  it('expiry of a STALE session keeps the booking (newer session in flight)', async () => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const booking = await seedBooking({
      stripeCheckoutSessionId: `dbtest_sess_newer_${stamp}`,
    });
    const event = signedEvent({
      type: 'checkout.session.expired',
      session: {
        id: `dbtest_sess_stale_${stamp}`,
        metadata: { bookingId: booking.id },
      },
    });

    const { status, body } = await post(event);
    expect(status).toBe(200);
    expect(body).toEqual({ received: true });

    const row = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { status: true, stripeCheckoutSessionId: true },
    });
    expect(row.status).toBe(BookingStatus.PENDING_PAYMENT);
    expect(row.stripeCheckoutSessionId).toBe(`dbtest_sess_newer_${stamp}`);
  });

  it('expiry never touches a CONFIRMED booking', async () => {
    const booking = await seedBooking({ status: BookingStatus.CONFIRMED });
    const event = signedEvent({
      type: 'checkout.session.expired',
      session: { metadata: { bookingId: booking.id } },
    });

    const { status, body } = await post(event);
    expect(status).toBe(200);
    expect(body).toEqual({ received: true });

    const row = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { status: true },
    });
    expect(row.status).toBe(BookingStatus.CONFIRMED);
  });

  it('rejects an invalid signature and a missing header with 400', async () => {
    // Signed with the WRONG secret → constructEvent throws → 400, and the
    // event is never claimed (no StripeEvent row).
    const forged = buildSignedCheckoutEvent({
      type: 'checkout.session.completed',
      session: { metadata: { bookingId: 'irrelevant' } },
      secret: 'whsec_wrong_0123456789abcdef',
    });
    const rejected = await post(forged);
    expect(rejected.status).toBe(400);
    const claimed = await db.stripeEvent.findUnique({
      where: { stripeEventId: forged.eventId },
    });
    expect(claimed).toBeNull();

    // Header absent entirely → 400 before any crypto.
    const valid = signedEvent({
      type: 'checkout.session.completed',
      session: { metadata: { bookingId: 'irrelevant' } },
    });
    headerState.current = new Headers();
    const res = await POST(webhookRequest(valid));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: 'Missing signature' });
  });

  it('an unknown event type is acknowledged 200 and marked PROCESSED (log-only)', async () => {
    // buildSignedCheckoutEvent is typed on the 3 checkout types — build the
    // envelope by hand and sign it with the stub's real webhook crypto.
    const eventId = `evt_dbtest_${Math.random().toString(36).slice(2, 12)}`;
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      api_version: '2025-12-15.clover',
      created: Math.floor(Date.now() / 1000),
      type: 'charge.refunded',
      data: { object: { id: `ch_dbtest_${eventId}`, object: 'charge' } },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
    });
    const signature = stripeStub.client.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });
    const event: SignedEvent = { payload, signature, eventId };
    eventIds.push(eventId);

    const { status, body } = await post(event);
    expect(status).toBe(200);
    expect(body).toEqual({ received: true });

    const stripeEvent = await db.stripeEvent.findUniqueOrThrow({
      where: { stripeEventId: eventId },
      select: { status: true, type: true },
    });
    expect(stripeEvent).toEqual({
      status: 'PROCESSED',
      type: 'charge.refunded',
    });
  });

  it('dispatches the gift settle: transfers.create called once on a gift-funded booking', async () => {
    stripeStub.fns.transfersCreate.mockClear();

    const booking = await seedBooking({
      giftCardId: 'gift_dbtest_settle_dispatch',
      giftAppliedCents: 5000,
    });
    const event = signedEvent({
      type: 'checkout.session.completed',
      session: {
        metadata: { bookingId: booking.id, giftAppliedCents: '5000' },
      },
    });

    const { status, body } = await post(event);
    expect(status).toBe(200);
    expect(body).toEqual({ received: true });

    // Dispatch only — the fine settle semantics belong to lot 3.
    expect(stripeStub.fns.transfersCreate).toHaveBeenCalledTimes(1);
    const row = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { status: true, giftTransferId: true },
    });
    expect(row.status).toBe(BookingStatus.CONFIRMED);
    expect(row.giftTransferId).not.toBeNull();
  });
});
