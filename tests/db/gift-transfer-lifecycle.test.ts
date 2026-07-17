/**
 * P-16 lot 3 (pré-launch, ADR-0003) — gift transfer lifecycle against a
 * REAL migrated database: triple idempotence of the platform→winery money
 * routing (settle / reversal / reconcile), including under concurrency.
 * The DB invariants are live (CHECK balance >= 0, append-only ledger
 * trigger); the Stripe network surface is the vi.fn stub, upgraded here
 * with real-Stripe idempotency-key semantics (concurrent calls sharing a
 * key collapse into ONE transfer — settleGiftTransfer's race branch
 * relies on it).
 *
 * Run with:
 *   INVARIANTS_DATABASE_URL=postgresql://... \
 *     npx vitest run tests/db/gift-transfer-lifecycle.test.ts
 * Skipped when the env var is absent.
 *
 * Gift cards and their ledger rows cannot be cleaned up (append-only
 * trigger, Restrict FK) — unique codes per run, never deleteMany on
 * gift_card_transactions. Same convention as
 * gift-redemption-concurrency.test.ts.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from 'vitest';
import {
  PrismaClient,
  BookingStatus,
  GiftCardTransactionType,
} from '@prisma/client';

import { makeStripeStub } from './helpers/stripe-stub';

const url = process.env.INVARIANTS_DATABASE_URL;

// The service module reads env.DATABASE_URL through @/server/db — point the
// real client at the invariants database BEFORE the dynamic imports below.
if (url) {
  process.env.DATABASE_URL = url;
}
// settleGiftTransfer / reverseGiftTransferForCancellation short-circuit the
// Stripe call entirely under E2E_TEST — this suite exercises the REAL call
// surface (stubbed), so force the bypass off.
delete process.env.E2E_TEST;

const stripeStub = makeStripeStub();

vi.mock('@/server/stripe', () => ({
  isStripeConfigured: () => true,
  getStripe: () => stripeStub.client,
}));

// The settle/cancel race branch pushes to Sentry — keep it inert and local.
vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

// ── Typed capture of the Stripe traffic ─────────────────────────────────
// The stub's vi.fn signatures are argument-less, so reading mock.calls is
// useless under noUncheckedIndexedAccess. Instead the implementations
// below record every MINTED object into typed arrays (an idempotent
// replay is not a new transfer) — the raw vi.fn call counts remain
// available for "no network attempt at all" assertions.

interface TransferCreateParams {
  amount: number;
  currency: string;
  destination: string;
  transfer_group: string;
  metadata: { bookingId: string; bookingReference: string };
}

interface ReversalParams {
  /** Absent = full reversal (the settle race safety net). */
  amount?: number;
  metadata: { bookingId: string; reason: string };
}

interface StripeRequestOptions {
  idempotencyKey?: string;
}

interface MintedTransfer {
  id: string;
  params: TransferCreateParams;
  idempotencyKey: string | undefined;
}

interface MintedReversal {
  id: string;
  transferId: string;
  params: ReversalParams;
  idempotencyKey: string | undefined;
}

const mintedTransfers: MintedTransfer[] = [];
const mintedReversals: MintedReversal[] = [];
let stripeSeq = 0;
// Promise cached SYNCHRONOUSLY per idempotencyKey, so two truly concurrent
// calls sharing a key observe the SAME transfer — real Stripe semantics.
const transferByKey = new Map<string, Promise<{ id: string }>>();
const reversalByKey = new Map<string, Promise<{ id: string }>>();

stripeStub.fns.transfersCreate.mockImplementation((...args: unknown[]) => {
  // The stub's vi.fn is declared argument-less; the service really calls
  // create(params, options) — narrow the runtime arguments.
  const params = args[0] as TransferCreateParams;
  const options = args[1] as StripeRequestOptions | undefined;
  const key = options?.idempotencyKey;
  if (key) {
    const cached = transferByKey.get(key);
    if (cached) return cached;
  }
  stripeSeq += 1;
  const id = `tr_lot3_${stripeSeq}`;
  mintedTransfers.push({ id, params, idempotencyKey: key });
  const created = Promise.resolve({ id });
  if (key) transferByKey.set(key, created);
  return created;
});

stripeStub.fns.transfersCreateReversal.mockImplementation(
  (...args: unknown[]) => {
    const transferId = args[0] as string;
    const params = args[1] as ReversalParams;
    const options = args[2] as StripeRequestOptions | undefined;
    const key = options?.idempotencyKey;
    if (key) {
      const cached = reversalByKey.get(key);
      if (cached) return cached;
    }
    stripeSeq += 1;
    const id = `trr_lot3_${stripeSeq}`;
    mintedReversals.push({ id, transferId, params, idempotencyKey: key });
    const created = Promise.resolve({ id });
    if (key) reversalByKey.set(key, created);
    return created;
  }
);

type TransferService =
  typeof import('@/server/services/giftCard-transfer.service');

describe.skipIf(!url)('gift transfer lifecycle (P-16 lot 3, ADR-0003)', () => {
  let db: PrismaClient;
  let settleGiftTransfer: TransferService['settleGiftTransfer'];
  let reverseGiftTransferForCancellation: TransferService['reverseGiftTransferForCancellation'];
  let reconcileGiftTransfers: TransferService['reconcileGiftTransfers'];

  const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const stripeAccountId = `acct_dbtest_lot3_${runId}`;
  const ids: { userId?: string; wineryId?: string; experienceId?: string } = {};
  let cardSeq = 0;

  beforeAll(async () => {
    ({
      settleGiftTransfer,
      reverseGiftTransferForCancellation,
      reconcileGiftTransfers,
    } = await import('@/server/services/giftCard-transfer.service'));
    db = new PrismaClient({ datasourceUrl: url });

    const user = await db.user.create({
      data: {
        email: `gift-lifecycle-${runId}@test.encave.ch`,
        role: 'WINEMAKER',
      },
    });
    ids.userId = user.id;
    const winery = await db.winery.create({
      data: {
        name: `Gift Lifecycle Winery ${runId}`,
        slug: `gift-lifecycle-${runId}`,
        description: 'Gift transfer lifecycle test fixture',
        address: 'Route du Test 9',
        commune: 'Sion',
        phone: '+41270000009',
        email: 'gift-lifecycle@test.encave.ch',
        userId: user.id,
        status: 'VERIFIED',
        stripeAccountId,
      },
    });
    ids.wineryId = winery.id;
    const experience = await db.experience.create({
      data: {
        wineryId: winery.id,
        title: 'Gift Lifecycle Experience',
        slug: `gift-lifecycle-${runId}`,
        description: 'x'.repeat(120),
        type: 'TASTING',
        duration: 90,
        price: 5000,
        minCapacity: 1,
        maxCapacity: 8,
        coverPhoto: 'https://example.com/cover.jpg',
        status: 'PUBLISHED',
      },
    });
    ids.experienceId = experience.id;
  });

  afterAll(async () => {
    // Gift cards + ledger rows are NOT cleaned (append-only by design);
    // bookings and the winery/user fixture are.
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

  beforeEach(() => {
    stripeStub.fns.transfersCreate.mockClear();
    stripeStub.fns.transfersCreateReversal.mockClear();
    mintedTransfers.length = 0;
    mintedReversals.length = 0;
  });

  /**
   * A gift-funded booking with a COHERENT ledger under the real CHECK:
   * a dedicated card is purchased at `giftCents` (PURCHASE row), then
   * fully redeemed by the booking (balance decrement + negative
   * REDEMPTION row) — balance 0 = SUM(ledger), like the real checkout.
   */
  async function makeGiftBooking(
    status: BookingStatus,
    overrides?: { giftCents?: number; wineryPayout?: number }
  ): Promise<{
    bookingId: string;
    cardId: string;
    payout: number;
    giftCents: number;
    reference: string;
  }> {
    if (!ids.experienceId || !ids.wineryId) throw new Error('fixture missing');
    const giftCents = overrides?.giftCents ?? 5000;
    const payout = overrides?.wineryPayout ?? 8800;
    cardSeq += 1;
    const card = await db.giftCard.create({
      data: {
        code: `GTL${runId}X${cardSeq}`,
        initialAmount: giftCents,
        balance: giftCents,
        purchaserEmail: 'gift-lifecycle@test.encave.ch',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    await db.giftCardTransaction.create({
      data: {
        giftCardId: card.id,
        type: GiftCardTransactionType.PURCHASE,
        amount: giftCents,
        note: 'test_fixture_purchase',
      },
    });
    const reference = `ENC-GT${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
    const booking = await db.booking.create({
      data: {
        reference,
        visitorEmail: 'gift-client@test.encave.ch',
        visitorName: 'Client Gift',
        visitorPhone: '+41790000002',
        experienceId: ids.experienceId,
        wineryId: ids.wineryId,
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        timeSlot: '10:00',
        guestCount: 2,
        totalPrice: 10000,
        platformFee: 1200,
        wineryPayout: payout,
        status,
        giftCardId: card.id,
        giftAppliedCents: giftCents,
      },
      select: { id: true },
    });
    await db.giftCard.update({
      where: { id: card.id },
      data: { balance: { decrement: giftCents } },
    });
    await db.giftCardTransaction.create({
      data: {
        giftCardId: card.id,
        type: GiftCardTransactionType.REDEMPTION,
        amount: -giftCents,
        bookingId: booking.id,
        note: 'checkout_redemption',
      },
    });
    return {
      bookingId: booking.id,
      cardId: card.id,
      payout,
      giftCents,
      reference,
    };
  }

  async function giftState(bookingId: string) {
    return db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        status: true,
        giftTransferId: true,
        giftTransferReversalId: true,
        refundError: true,
      },
    });
  }

  function transfersFor(bookingId: string): MintedTransfer[] {
    return mintedTransfers.filter(
      (t) => t.params.metadata.bookingId === bookingId
    );
  }

  // ── 1. Settle nominal ──────────────────────────────────────────────────

  it('settle nominal: one transfer of wineryPayout, correct params, giftTransferId recorded', async () => {
    const { bookingId, payout, reference } = await makeGiftBooking(
      BookingStatus.CONFIRMED
    );

    const outcome = await settleGiftTransfer(bookingId);

    expect(outcome).toBe('transferred');
    expect(stripeStub.fns.transfersCreate).toHaveBeenCalledTimes(1);
    const call = mintedTransfers[0];
    if (!call) throw new Error('expected a minted transfer');
    expect(call.params.amount).toBe(payout);
    expect(call.params.currency).toBe('chf');
    expect(call.params.destination).toBe(stripeAccountId);
    expect(call.params.transfer_group).toBe(`booking_${bookingId}`);
    expect(call.params.metadata.bookingId).toBe(bookingId);
    expect(call.params.metadata.bookingReference).toBe(reference);
    expect(call.idempotencyKey).toBe(`gift_payout_${bookingId}`);

    const state = await giftState(bookingId);
    expect(state.giftTransferId).toBe(call.id);
    expect(state.giftTransferReversalId).toBeNull();
    expect(state.refundError).toBeNull();
    expect(stripeStub.fns.transfersCreateReversal).not.toHaveBeenCalled();
  });

  // ── 2. Settle double séquentiel ────────────────────────────────────────

  it('settle twice sequentially: second call is a durable-guard noop, single transfer', async () => {
    const { bookingId } = await makeGiftBooking(BookingStatus.CONFIRMED);

    expect(await settleGiftTransfer(bookingId)).toBe('transferred');
    const first = await giftState(bookingId);

    expect(await settleGiftTransfer(bookingId)).toBe('noop');
    // The durable guard short-circuits BEFORE Stripe: one network call ever.
    expect(stripeStub.fns.transfersCreate).toHaveBeenCalledTimes(1);
    expect(mintedTransfers).toHaveLength(1);
    const second = await giftState(bookingId);
    expect(second.giftTransferId).toBe(first.giftTransferId);
  });

  // ── 3. Settle concurrent ───────────────────────────────────────────────

  it('settle ×2 concurrent (same booking): exactly one net transfer, no safety reversal', async () => {
    const { bookingId } = await makeGiftBooking(BookingStatus.CONFIRMED);

    const [r1, r2] = await Promise.all([
      settleGiftTransfer(bookingId),
      settleGiftTransfer(bookingId),
    ]);

    // One writer wins the conditional write; the other lands on the
    // idempotency-collapse noop (current.giftTransferId === transfer.id)
    // or on the durable guard, depending on interleaving.
    expect([r1, r2].sort()).toEqual(['noop', 'transferred']);

    // THE invariant: Stripe idempotency collapsed everything into a single
    // minted transfer — never two net transfers for one booking.
    expect(mintedTransfers).toHaveLength(1);
    expect(stripeStub.fns.transfersCreateReversal).not.toHaveBeenCalled();

    const minted = mintedTransfers[0];
    if (!minted) throw new Error('expected a minted transfer');
    const state = await giftState(bookingId);
    expect(state.giftTransferId).toBe(minted.id);
    expect(state.refundError).toBeNull();
  });

  it('settle duplicate minted post-creation (no key collapse): loser fully reverses its OWN transfer', async () => {
    // Models the ADR-0003 safety net when Stripe did NOT collapse (e.g. a
    // redelivery beyond the 24h idempotency window): a concurrent settle
    // records ITS transfer while ours is still in flight at Stripe.
    const { bookingId } = await makeGiftBooking(BookingStatus.CONFIRMED);
    const winnerTransferId = `tr_lot3_previous_winner_${runId}`;
    const duplicateId = `tr_lot3_duplicate_${runId}`;

    stripeStub.fns.transfersCreate.mockImplementationOnce(async () => {
      await db.booking.update({
        where: { id: bookingId },
        data: { giftTransferId: winnerTransferId },
      });
      return { id: duplicateId };
    });

    const outcome = await settleGiftTransfer(bookingId);

    expect(outcome).toBe('skipped');
    const state = await giftState(bookingId);
    // The winner's transfer stands untouched…
    expect(state.giftTransferId).toBe(winnerTransferId);
    // …and OUR duplicate is fully reversed (no amount = total), with the
    // dedicated race idempotency key and the persisted audit marker.
    const reversal = mintedReversals.find((r) => r.transferId === duplicateId);
    if (!reversal) {
      throw new Error('expected the duplicate transfer to be fully reversed');
    }
    expect(reversal.params.amount).toBeUndefined();
    expect(reversal.params.metadata.reason).toBe('settle_cancellation_race');
    expect(reversal.idempotencyKey).toBe(
      `gift_payout_race_reversal_${bookingId}`
    );
    expect(state.refundError).toContain('GIFT_RACE_REVERSED');
    expect(state.refundError).toContain(duplicateId);
  });

  // ── 4. Settle sur booking non-CONFIRMED ────────────────────────────────

  it('settle on a non-CONFIRMED booking: no Stripe call, giftTransferId stays null', async () => {
    const pending = await makeGiftBooking(BookingStatus.PENDING_PAYMENT);
    const cancelled = await makeGiftBooking(BookingStatus.CANCELLED_BY_CLIENT);

    expect(await settleGiftTransfer(pending.bookingId)).toBe('skipped');
    expect(await settleGiftTransfer(cancelled.bookingId)).toBe('skipped');

    expect(stripeStub.fns.transfersCreate).not.toHaveBeenCalled();
    expect(mintedTransfers).toHaveLength(0);
    expect((await giftState(pending.bookingId)).giftTransferId).toBeNull();
    expect((await giftState(cancelled.bookingId)).giftTransferId).toBeNull();
  });

  // ── 5. Settle échoue puis retry ────────────────────────────────────────

  it('settle Stripe failure: throws, nothing recorded, a later retry lands exactly one transfer', async () => {
    const { bookingId } = await makeGiftBooking(BookingStatus.CONFIRMED);

    // The service does not discriminate the error type — ANY Stripe throw
    // propagates to the caller (webhook retries / reconcile cron), so a
    // plain Error faithfully models transient balance_insufficient.
    stripeStub.fns.transfersCreate.mockRejectedValueOnce(
      new Error('balance_insufficient')
    );

    await expect(settleGiftTransfer(bookingId)).rejects.toThrow(
      'balance_insufficient'
    );
    expect((await giftState(bookingId)).giftTransferId).toBeNull();

    const retry = await settleGiftTransfer(bookingId);
    expect(retry).toBe('transferred');
    // Two network attempts, ONE minted transfer overall.
    expect(stripeStub.fns.transfersCreate).toHaveBeenCalledTimes(2);
    expect(mintedTransfers).toHaveLength(1);
    const minted = mintedTransfers[0];
    if (!minted) throw new Error('expected a minted transfer');
    expect((await giftState(bookingId)).giftTransferId).toBe(minted.id);
  });

  // ── 6. Reversal nominal + idempotence + cap ────────────────────────────

  it('reversal nominal: proportional clawback once, re-call is a durable-guard noop', async () => {
    const { bookingId, payout } = await makeGiftBooking(
      BookingStatus.CONFIRMED
    );
    await settleGiftTransfer(bookingId);
    await db.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED_BY_CLIENT },
    });

    // STRICT 48h–7j tier: 50% refund → 50% winery clawback (ADR-0003).
    const reversalCents = Math.round((payout * 50) / 100);
    const outcome = await reverseGiftTransferForCancellation(
      bookingId,
      reversalCents
    );

    expect(outcome).toBe('reversed');
    const state = await giftState(bookingId);
    const reversal = mintedReversals[0];
    if (!reversal) throw new Error('expected a minted reversal');
    expect(mintedReversals).toHaveLength(1);
    expect(reversal.transferId).toBe(state.giftTransferId);
    expect(reversal.params.amount).toBe(reversalCents);
    expect(reversal.params.metadata).toEqual({
      bookingId,
      reason: 'booking_cancellation',
    });
    expect(reversal.idempotencyKey).toBe(`gift_reversal_${bookingId}`);
    expect(state.giftTransferReversalId).toBe(reversal.id);

    // Idempotence: the durable guard stops a redelivery before Stripe.
    expect(
      await reverseGiftTransferForCancellation(bookingId, reversalCents)
    ).toBe('noop');
    expect(stripeStub.fns.transfersCreateReversal).toHaveBeenCalledTimes(1);
    expect(mintedReversals).toHaveLength(1);
    expect((await giftState(bookingId)).giftTransferReversalId).toBe(
      reversal.id
    );
  });

  it('reversal is capped at the transferred amount (min with wineryPayout)', async () => {
    const { bookingId, payout } = await makeGiftBooking(
      BookingStatus.CONFIRMED
    );
    await settleGiftTransfer(bookingId);
    await db.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED_BY_CLIENT },
    });

    const outcome = await reverseGiftTransferForCancellation(
      bookingId,
      payout + 999
    );

    expect(outcome).toBe('reversed');
    const reversal = mintedReversals[0];
    if (!reversal) throw new Error('expected a minted reversal');
    expect(reversal.params.amount).toBe(payout);
  });

  // ── 7. Reversal sans transfert ─────────────────────────────────────────

  it('reversal with no settled transfer: clean no-op, zero Stripe calls', async () => {
    const { bookingId, payout } = await makeGiftBooking(
      BookingStatus.CONFIRMED
    );
    // Cancelled before any settle — the real call-site situation (also
    // keeps this booking out of the later reconcile sweep).
    await db.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED_BY_CLIENT },
    });

    expect(await reverseGiftTransferForCancellation(bookingId, payout)).toBe(
      'no-transfer'
    );
    expect(await reverseGiftTransferForCancellation(bookingId, 0)).toBe('noop');

    expect(stripeStub.fns.transfersCreateReversal).not.toHaveBeenCalled();
    expect(mintedReversals).toHaveLength(0);
    const state = await giftState(bookingId);
    expect(state.giftTransferId).toBeNull();
    expect(state.giftTransferReversalId).toBeNull();
  });

  // ── 8. Course settle vs cancel ─────────────────────────────────────────

  it('settle racing a cancellation: never a net un-reversed transfer on a cancelled booking', async () => {
    // 5 fresh bookings with a staggered cancellation start (0..4ms) to
    // sweep interleavings — every legal outcome must satisfy the ADR-0003
    // fixed point, whichever contender wins.
    for (let i = 0; i < 5; i += 1) {
      const { bookingId, payout } = await makeGiftBooking(
        BookingStatus.CONFIRMED
      );
      const transfersBefore = mintedTransfers.length;
      const reversalsBefore = mintedReversals.length;

      // Mirrors cancelBooking: claim the booking (status flip), then the
      // post-cancellation clawback (100% refund tier here).
      const cancelFlow = async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, i));
        await db.booking.updateMany({
          where: { id: bookingId, status: BookingStatus.CONFIRMED },
          data: { status: BookingStatus.CANCELLED_BY_CLIENT },
        });
        return reverseGiftTransferForCancellation(bookingId, payout);
      };

      const [settleOutcome, reverseOutcome] = await Promise.all([
        settleGiftTransfer(bookingId),
        cancelFlow(),
      ]);

      const state = await giftState(bookingId);
      expect(state.status).toBe(BookingStatus.CANCELLED_BY_CLIENT);
      const minted = mintedTransfers
        .slice(transfersBefore)
        .filter((t) => t.params.metadata.bookingId === bookingId);
      const reversed = mintedReversals
        .slice(reversalsBefore)
        .filter((r) => r.params.metadata.bookingId === bookingId);

      if (state.giftTransferId !== null) {
        // Settle recorded before the cancellation claimed the booking →
        // the cancellation MUST have clawed the payout back. This is the
        // exact hole ADR-0003 closes: giftTransferId set on a cancelled
        // booking without a reversal would leave the winery paid.
        expect(settleOutcome).toBe('transferred');
        expect(reverseOutcome).toBe('reversed');
        expect(state.giftTransferReversalId).not.toBeNull();
        expect(minted).toHaveLength(1);
        const clawback = reversed.find(
          (r) => r.transferId === state.giftTransferId
        );
        if (!clawback) {
          throw new Error(
            `iteration ${i}: settled transfer left un-reversed on a cancelled booking`
          );
        }
        expect(clawback.params.amount).toBe(payout);
        expect(clawback.idempotencyKey).toBe(`gift_reversal_${bookingId}`);
      } else {
        // Cancellation won: either settle never transferred (status guard
        // caught it pre-Stripe), or it minted mid-race and fully reversed
        // its own transfer (safety net + persisted marker).
        expect(reverseOutcome).toBe('no-transfer');
        expect(state.giftTransferReversalId).toBeNull();
        expect(settleOutcome).toBe('skipped');
        if (minted.length === 0) {
          expect(reversed).toHaveLength(0);
        } else {
          expect(minted).toHaveLength(1);
          const stray = minted[0];
          if (!stray) throw new Error('unreachable: minted has length 1');
          const safety = reversed.find((r) => r.transferId === stray.id);
          if (!safety) {
            throw new Error(
              `iteration ${i}: mid-race transfer left un-reversed on a cancelled booking`
            );
          }
          expect(safety.params.amount).toBeUndefined();
          expect(safety.params.metadata.reason).toBe(
            'settle_cancellation_race'
          );
          expect(state.refundError).toContain('GIFT_RACE_REVERSED');
        }
      }
    }
  });

  // ── 9. Reconcile ───────────────────────────────────────────────────────

  it('reconcile: catches up a missed settle, is a fixed point on re-run, ignores settled bookings', async () => {
    // NOTE: the GIFT_CARDS flag is enforced by the cron ROUTE
    // (/api/cron/reconcile-gift-transfers), not by the function — no flag
    // seeding needed to drive reconcileGiftTransfers directly.
    const missed = await makeGiftBooking(BookingStatus.CONFIRMED);
    const settled = await makeGiftBooking(BookingStatus.CONFIRMED);
    await settleGiftTransfer(settled.bookingId);
    const settledBefore = await giftState(settled.bookingId);

    // (a) the missed booking is caught up with exactly one transfer.
    const stats = await reconcileGiftTransfers();
    expect(stats.failed).toBe(0);
    // ≥: the sweep is DB-wide, sibling suites may leave their own strays
    // in a shared invariants database — assert per-booking, not globally.
    expect(stats.transferred).toBeGreaterThanOrEqual(1);
    const missedState = await giftState(missed.bookingId);
    const caughtUp = transfersFor(missed.bookingId);
    expect(caughtUp).toHaveLength(1);
    const caughtUpTransfer = caughtUp[0];
    if (!caughtUpTransfer) throw new Error('expected a minted transfer');
    expect(missedState.giftTransferId).toBe(caughtUpTransfer.id);
    expect(caughtUpTransfer.params.amount).toBe(missed.payout);

    // (c) the already-settled booking was ignored (durable guard).
    expect(transfersFor(settled.bookingId)).toHaveLength(1); // direct settle only
    expect((await giftState(settled.bookingId)).giftTransferId).toBe(
      settledBefore.giftTransferId
    );

    // (b) fixed point: a re-run mints nothing new for either booking.
    await reconcileGiftTransfers();
    expect(transfersFor(missed.bookingId)).toHaveLength(1);
    expect(transfersFor(settled.bookingId)).toHaveLength(1);
    expect((await giftState(missed.bookingId)).giftTransferId).toBe(
      caughtUpTransfer.id
    );
    expect(mintedReversals).toHaveLength(0);
  });

  // ── 10. Invariants DB réels ────────────────────────────────────────────

  it('DB rejects any write driving a balance negative (CHECK) and any ledger rewrite (append-only trigger)', async () => {
    const { cardId } = await makeGiftBooking(BookingStatus.CONFIRMED, {
      giftCents: 1000,
    });
    // Balance is 0 after the fixture's full redemption: any further debit
    // must be stopped by gift_cards_balance_non_negative, not app code.
    await expect(
      db.giftCard.update({
        where: { id: cardId },
        data: { balance: { decrement: 1 } },
      })
    ).rejects.toThrow();
    await expect(
      db.giftCard.update({ where: { id: cardId }, data: { balance: -500 } })
    ).rejects.toThrow();
    const card = await db.giftCard.findUniqueOrThrow({
      where: { id: cardId },
      select: { balance: true },
    });
    expect(card.balance).toBe(0);

    // The ledger stays reconcilable: UPDATE and DELETE are both rejected
    // by the append-only trigger; ground truth = the row is unchanged.
    const movement = await db.giftCardTransaction.findFirstOrThrow({
      where: { giftCardId: cardId, type: GiftCardTransactionType.PURCHASE },
      select: { id: true, amount: true },
    });
    await expect(
      db.giftCardTransaction.update({
        where: { id: movement.id },
        data: { amount: 999999 },
      })
    ).rejects.toThrow();
    await expect(
      db.giftCardTransaction.delete({ where: { id: movement.id } })
    ).rejects.toThrow();
    const survivor = await db.giftCardTransaction.findUniqueOrThrow({
      where: { id: movement.id },
      select: { amount: true },
    });
    expect(survivor.amount).toBe(movement.amount);
  });
});
