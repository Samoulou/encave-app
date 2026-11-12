import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import { getStripe, isStripeConfigured } from '@/server/stripe';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { BookingStatus, NoShowChargeStatus } from '@prisma/client';
import {
  confirmBookingFromPaidCheckoutSession,
  confirmImprintBookingFromSetupSession,
} from '@/server/services/checkout-confirmation.service';
import {
  createGiftCardFromPayment,
  disableGiftCardForPayment,
} from '@/server/services/giftCard.service';
import { settleGiftTransfer } from '@/server/services/giftCard-transfer.service';
import {
  releaseGiftForBooking,
  releaseGiftForBookingInTx,
} from '@/server/services/giftCard-redemption.service';
import { syncBookingRefundFromStripe } from '@/server/services/booking-refund.service';
import { flipRequestOfferPaid } from '@/server/services/request.service';
import { refundOrphanedCheckoutPayment } from '@/server/services/payment.service';
import { logError, logInfo, logWarn } from '@/lib/logger';
import {
  claimStripeEvent,
  markStripeEventFailed,
  markStripeEventProcessed,
} from '@/server/services/stripe-event.service';

/**
 * Explicit budget for the handler (Stripe + DB + emails/PDF). MUST stay well
 * under STALE_STRIPE_EVENT_MINUTES (stripe-event.service): a run still alive
 * past the stale threshold could be reclaimed and double-processed.
 */
export const maxDuration = 60;

/**
 * A `checkout.session.expired` event for a booking whose own expiry is
 * still further away than this was RE-CLAIMED: the client retried after an
 * aborted payment, the action extended the hold (now + 30 min) and expired
 * the old session itself — its expiry webhook can land before the new
 * session id is written on the row. A naturally expired session arrives
 * AFTER the booking's expiry (both are aligned on `session.expires_at`), so
 * a couple of minutes absorb any clock skew without ever matching it.
 */
const RECLAIM_GUARD_MS = 2 * 60 * 1000;

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    logError('Stripe is not configured');
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    );
  }
  const stripe = getStripe();

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logError('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    logError('Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logError('Webhook signature verification failed', err);
    return NextResponse.json(
      {
        error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 400 }
    );
  }

  const claim = await claimStripeEvent(event);
  if (claim === 'in_progress') {
    // Another delivery of this event is mid-handler. A 2xx here would end
    // Stripe's retries — if that run then dies, the event is lost for good.
    // 409 keeps Stripe redelivering until it is PROCESSED or reclaimable.
    return NextResponse.json(
      { error: 'Event is being processed', retry: true },
      { status: 409 }
    );
  }
  if (claim === 'duplicate') {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      // Delayed-settlement methods (e.g. some TWINT flows) fire `completed`
      // unpaid and settle later with this event — handle both so a gift
      // card / booking is created once the money actually lands. The
      // handler is idempotent (payment_status + StripeEvent guards).
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(session);
        break;
      }

      // A delayed-settlement method (TWINT) can fail after `completed` already
      // fired unpaid — Stripe's authoritative "it's dead" signal, since the
      // session itself stays `status: 'complete'` / `payment_status: 'unpaid'`
      // forever (indistinguishable from "still settling" — the expiration cron
      // treats any 'complete' session as unsafe to touch for that reason).
      // Without this handler the booking would stay PENDING_PAYMENT forever
      // (P-16 review finding).
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutAsyncPaymentFailed(session);
        break;
      }

      // Money that moved OUTSIDE the app (M3): a chargeback opened by the
      // cardholder, or a refund issued from the Stripe Dashboard. The
      // endpoint must be subscribed to these three event types.
      case 'charge.dispute.created': {
        await handleChargeDispute(
          event.data.object as Stripe.Dispute,
          'opened'
        );
        break;
      }
      case 'charge.dispute.closed': {
        await handleChargeDispute(
          event.data.object as Stripe.Dispute,
          'closed'
        );
        break;
      }
      case 'charge.refunded': {
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      }

      default:
        // Log unhandled events but don't fail
        logInfo('Unhandled checkout event type', { eventType: event.type });
    }

    await markStripeEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    logError('Error processing checkout webhook', error);
    await markStripeEventFailed(event.id, error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed event
 * Updates booking status to CONFIRMED and sends confirmation emails
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Gift-card purchases (P-09) ride the same completed event but are not
  // bookings — the metadata discriminates. Creates the card via the
  // ledger, sends email #6, schedules #7.
  if (session.metadata?.kind === 'gift_card') {
    await createGiftCardFromPayment(session);
    return;
  }

  // Sur-mesure offer payment (P-10): the booking is confirmed exactly like a
  // normal booking (same metadata.bookingId), then the offer/request flip to
  // PAID. The status flip runs only after a real confirmation and is
  // idempotent on redelivery (guarded updateMany inside flipRequestOfferPaid).
  if (session.metadata?.kind === 'request_offer') {
    const { result } = await confirmBookingFromPaidCheckoutSession(
      session,
      'webhook'
    );
    if (result === 'missing_payment_intent') {
      throw new Error('Checkout session has no payment intent');
    }
    if (result === 'confirmed' || result === 'already_confirmed') {
      const requestOfferId = session.metadata?.requestOfferId;
      if (requestOfferId) {
        await flipRequestOfferPaid(requestOfferId);
      }
    } else if (result === 'missing_booking') {
      await refundOrphanedCheckoutPayment(session);
    } else if (result === 'not_pending') {
      await refundOrphanIfCancelledNeverConfirmed(session);
    } else if (result === 'session_mismatch') {
      await refundPaidSessionMismatch(session);
    } else if (result === 'amount_mismatch') {
      await refundPaidAmountMismatch(session);
    }
    return;
  }

  // No-show card imprint (P-08): a mode:'setup' session carries a setup_intent
  // (not a payment_intent) and is 'no_payment_required' — vault the card and
  // confirm the booking without any charge.
  if (session.metadata?.kind === 'no_show_setup') {
    await confirmImprintBookingFromSetupSession(session);
    return;
  }

  const { result } = await confirmBookingFromPaidCheckoutSession(
    session,
    'webhook'
  );

  if (result === 'missing_payment_intent') {
    throw new Error('Checkout session has no payment intent');
  }

  // Orphaned paid session: the client PAID but the booking can no longer be
  // fulfilled (deleted, or cancelled while pending and never confirmed — the
  // settlement race). Refund the stranded charge instead of silently keeping
  // the money. Guarded to genuine orphans only — a FULFILLED (COMPLETED /
  // NO_SHOW) or confirmed-then-refunded booking is never clawed back.
  if (result === 'missing_booking') {
    await refundOrphanedCheckoutPayment(session);
    return;
  }
  if (result === 'not_pending') {
    await refundOrphanIfCancelledNeverConfirmed(session);
    return;
  }
  // PAID on a session the booking no longer points at (a newer session was
  // minted for the same booking, or the booking was already paid on another
  // one). Never acknowledge it silently — and never settle a gift transfer
  // on it: the gift state on the booking belongs to the CURRENT session.
  if (result === 'session_mismatch') {
    await refundPaidSessionMismatch(session);
    return;
  }
  // PAID, but not the amount the booking owes — never confirmed silently.
  if (result === 'amount_mismatch') {
    await refundPaidAmountMismatch(session);
    return;
  }

  // Gift-redeemed booking (P-09): settle the platform→winery transfer of
  // the gift-covered part, INDEPENDENTLY of the confirmation result — it
  // runs on every delivery while giftTransferId is still null (Luca §2/§5),
  // so a redelivery after an 'already_confirmed' still lands the transfer.
  // A Stripe failure throws → the event is marked FAILED and retried.
  if (session.metadata?.giftAppliedCents) {
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      await settleGiftTransfer(bookingId);
    }
  }
}

/**
 * A PAID Checkout Session that is not the one its booking currently points at
 * (`session_mismatch`): the client was charged on a superseded session — a
 * second tab/device on the same sur-mesure offer, or a double payment after
 * the booking was already confirmed on another session.
 *
 * Decision: REFUND, never "confirm on the stale session". The booking's money
 * fields (totals, service fee, gift redemption) and its hold window were
 * rewritten for the CURRENT session; confirming on the old one would record a
 * booking whose amounts may not match what was charged, leave the current
 * session payable (double charge) and settle a gift transfer on the wrong
 * redemption. The refund reuses the orphan path: idempotent on the session id
 * (Stripe key + already-refunded tolerance), `reverse_transfer` derived from
 * the session itself. The booking is left untouched — it stays payable on its
 * current session, or CONFIRMED if it already was.
 *
 * A Stripe failure throws → the event is marked FAILED and redelivered.
 */
async function refundPaidSessionMismatch(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;
  logError(
    'Paid checkout session does not match its booking — refunding',
    undefined,
    {
      action: 'refundPaidSessionMismatch',
      bookingId,
      sessionId: session.id,
      kind: session.metadata?.kind ?? 'booking',
      amountTotal: session.amount_total,
    }
  );
  Sentry.captureMessage('paid checkout session mismatch — refunded', {
    level: 'error',
    tags: { area: 'stripe-webhook', incident: 'session-mismatch' },
    extra: {
      bookingId,
      sessionId: session.id,
      kind: session.metadata?.kind ?? 'booking',
      amountTotal: session.amount_total,
    },
  });
  await refundOrphanedCheckoutPayment(session);
}

/**
 * A PAID session whose total is not what its booking owes
 * (`amount_mismatch`, checkout-confirmation.service). Every session is
 * built server-side from the booking, so this is a bug or a stale session
 * that slipped through — the booking was NOT confirmed. Give the money
 * back (orphan path, idempotent on the session id) and alert; the booking
 * stays pending and expires normally.
 */
async function refundPaidAmountMismatch(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;
  logError(
    'Paid checkout amount does not match its booking — refunding',
    undefined,
    {
      action: 'refundPaidAmountMismatch',
      bookingId,
      sessionId: session.id,
      amountTotal: session.amount_total,
    }
  );
  Sentry.captureMessage('paid checkout amount mismatch — refunded', {
    level: 'error',
    tags: { area: 'stripe-webhook', incident: 'amount-mismatch' },
    extra: {
      bookingId,
      sessionId: session.id,
      kind: session.metadata?.kind ?? 'booking',
      amountTotal: session.amount_total,
    },
  });
  await refundOrphanedCheckoutPayment(session);
}

/**
 * A paid session whose booking is `not_pending`: refund ONLY when the booking
 * is CANCELLED and was never confirmed (no stripePaymentIntentId) — a pure
 * orphan from the cancel-while-pending settlement race. A COMPLETED / NO_SHOW
 * booking was fulfilled, and a confirmed-then-cancelled booking already ran
 * its own policy refund (and carries a stripePaymentIntentId), so neither is
 * clawed back here.
 */
async function refundOrphanIfCancelledNeverConfirmed(
  session: Stripe.Checkout.Session
) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, stripePaymentIntentId: true, reference: true },
  });

  const isCancelled =
    booking?.status === BookingStatus.CANCELLED_BY_CLIENT ||
    booking?.status === BookingStatus.CANCELLED_BY_WINERY;

  if (booking && isCancelled && booking.stripePaymentIntentId === null) {
    await refundOrphanedCheckoutPayment(session);
    return;
  }

  logInfo('Paid session on a terminal/served booking — no orphan refund', {
    bookingId,
    status: booking?.status,
  });
}

/**
 * Handle checkout.session.expired event
 * Cancels the pending booking
 */
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  // Gift-card sessions create no pre-payment row — nothing to clean up.
  if (session.metadata?.kind === 'gift_card') {
    return;
  }

  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    logError('No bookingId in session metadata');
    return;
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      reference: true,
      stripeCheckoutSessionId: true,
      expiresAt: true,
    },
  });

  if (!booking) {
    // The row is already gone (a previous delivery of this event, or the
    // hold cleanup). A deleted booking can never use its gift again, so
    // returning whatever is still reserved is always right — and it makes
    // this handler safe to REPLAY: the redemption is keyed by bookingId and
    // survives the row (no FK). Idempotent, no-op without a gift.
    const released = await releaseGiftForBooking(bookingId);
    logInfo('Expired session — booking already gone', {
      bookingId,
      giftReleased: released === 'refunded',
    });
    return;
  }

  // Only cancel if still pending
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    logInfo('Booking not pending payment, not cancelling', {
      bookingRef: booking.reference,
      status: booking.status,
    });
    return;
  }

  // A retry (hold re-claim) attaches a NEWER session to the same booking.
  // Only the session the booking currently points at may destroy it —
  // a stale session's expiry must never delete a booking being paid on
  // the newer one (P-04 review finding).
  if (
    booking.stripeCheckoutSessionId &&
    booking.stripeCheckoutSessionId !== session.id
  ) {
    logInfo('Stale session expired — booking has a newer session, keeping', {
      bookingRef: booking.reference,
      expiredSessionId: session.id,
      currentSessionId: booking.stripeCheckoutSessionId,
    });
    return;
  }

  // Re-claim IN FLIGHT: the booking still points at this (just expired)
  // session, but its own expiry was pushed into the future — the client is
  // retrying right now and the new session id is not written yet. Deleting
  // here killed the booking under the retry (and, with a gift, could strand
  // the re-redemption on a row that no longer exists). If the retry never
  // completes, the expiry sweep cleans the row once its window is over.
  const reclaimCutoff = new Date(Date.now() + RECLAIM_GUARD_MS);
  if (booking.expiresAt && booking.expiresAt > reclaimCutoff) {
    logInfo('Expired session — booking was re-claimed, keeping', {
      bookingRef: booking.reference,
      expiredSessionId: session.id,
      bookingExpiresAt: booking.expiresAt.toISOString(),
    });
    return;
  }

  // Guarded delete (replaces a check-then-delete TOCTOU): only remove a
  // booking STILL pending payment on THIS session (or one that hasn't had a
  // session id attached yet) and NOT re-claimed meanwhile. A concurrent
  // confirmation (CAS → CONFIRMED), a newer session or a re-claim must
  // survive — never delete a booking being paid (P-04).
  //
  // The delete and the gift release are ONE transaction: done as two
  // statements, a failure in between left the row gone with its redemption
  // still reserved, and the redelivery had nothing left to act on.
  const deleted = await db.$transaction(async (tx) => {
    const result = await tx.booking.deleteMany({
      where: {
        id: bookingId,
        status: BookingStatus.PENDING_PAYMENT,
        AND: [
          {
            OR: [
              { stripeCheckoutSessionId: session.id },
              { stripeCheckoutSessionId: null },
            ],
          },
          { OR: [{ expiresAt: null }, { expiresAt: { lte: reclaimCutoff } }] },
        ],
      },
    });
    if (result.count === 0) return false;
    // Idempotent, no-op when no gift was applied (P-09, Luca §4).
    await releaseGiftForBookingInTx(tx, bookingId);
    return true;
  });

  if (!deleted) {
    logInfo(
      'Expired session — booking confirmed/paid, re-claimed or on a newer session, kept',
      {
        bookingRef: booking.reference,
        expiredSessionId: session.id,
      }
    );
    return;
  }

  logInfo('Booking deleted due to checkout session expiry', {
    bookingRef: booking.reference,
  });
}

/**
 * Handle checkout.session.async_payment_failed event.
 *
 * Unlike an expired session (customer never acted), this is a real payment
 * attempt that Stripe has now definitively failed — cancel rather than
 * delete, so the attempt stays visible for support.
 */
async function handleCheckoutAsyncPaymentFailed(
  session: Stripe.Checkout.Session
) {
  // Gift-card sessions create no pre-payment row — nothing to clean up.
  if (session.metadata?.kind === 'gift_card') {
    return;
  }

  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    logError('No bookingId in session metadata');
    return;
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      reference: true,
      stripeCheckoutSessionId: true,
    },
  });

  if (!booking) {
    logError('Booking not found', undefined, { bookingId });
    return;
  }

  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    logInfo('Booking not pending payment, ignoring async payment failure', {
      bookingRef: booking.reference,
      status: booking.status,
    });
    return;
  }

  // Same staleness guard as the expired-session handler: a retry attaches a
  // NEWER session to the booking, so a stale session's failure must never
  // cancel a booking being paid on the newer one.
  if (
    booking.stripeCheckoutSessionId &&
    booking.stripeCheckoutSessionId !== session.id
  ) {
    logInfo('Stale session failed — booking has a newer session, keeping', {
      bookingRef: booking.reference,
      failedSessionId: session.id,
      currentSessionId: booking.stripeCheckoutSessionId,
    });
    return;
  }

  // Cancellation + gift release in ONE transaction (same reason as the
  // expiry handler): a replay finds the booking already cancelled and
  // returns early, so the release must never be left behind.
  const cancelled = await db.$transaction(async (tx) => {
    const result = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.PENDING_PAYMENT,
        OR: [
          { stripeCheckoutSessionId: session.id },
          { stripeCheckoutSessionId: null },
        ],
      },
      data: {
        status: BookingStatus.CANCELLED_BY_CLIENT,
        cancelledAt: new Date(),
        cancellationReason: 'PAYMENT_FAILED',
      },
    });
    if (result.count === 0) return false;
    // Idempotent, no-op when no gift was applied (P-09, Luca §4).
    await releaseGiftForBookingInTx(tx, bookingId);
    return true;
  });

  if (!cancelled) {
    logInfo(
      'Async payment failed — booking confirmed/paid or on a newer session, kept',
      { bookingRef: booking.reference, failedSessionId: session.id }
    );
    return;
  }

  logInfo('Booking cancelled due to async payment failure', {
    bookingRef: booking.reference,
  });
}

function paymentIntentIdOf(
  value: string | Stripe.PaymentIntent | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

/**
 * `charge.dispute.created` / `charge.dispute.closed` — a cardholder
 * chargeback. On a destination charge the PLATFORM is debited (amount +
 * dispute fee); nothing in the app used to know.
 *
 *  - Dispute on a GIFT CARD purchase: the card is DISABLED at once (same
 *    status flip as the admin action — balance and ledger untouched). A
 *    card bought with a stolen card would otherwise stay redeemable and
 *    the platform would pay the winery out of its own balance. What was
 *    already redeemed is reported as exposure.
 *  - Dispute on a booking (or its no-show fee): nothing destructive — the
 *    booking is real, the dispute may be won. Alert with the reference.
 *
 * `closed` only reports the outcome: a disabled card is NOT re-enabled
 * automatically (it may have been disabled for another reason) — an admin
 * decides on a won dispute.
 */
async function handleChargeDispute(
  dispute: Stripe.Dispute,
  phase: 'opened' | 'closed'
) {
  const paymentIntentId = paymentIntentIdOf(dispute.payment_intent);
  const base = {
    disputeId: dispute.id,
    phase,
    disputeStatus: dispute.status,
    reason: dispute.reason,
    amountCents: dispute.amount,
    paymentIntentId,
  };
  const alert = (target: string, extra: Record<string, unknown>) => {
    logError(`Stripe dispute ${phase} — ${target}`, undefined, {
      action: 'handleChargeDispute',
      ...base,
      ...extra,
    });
    Sentry.captureMessage(`stripe dispute ${phase}: ${target}`, {
      // A lost/open dispute is money leaving; a won one is good news.
      level: phase === 'closed' && dispute.status === 'won' ? 'info' : 'error',
      tags: { area: 'stripe-webhook', incident: 'dispute', target },
      extra: { ...base, ...extra },
    });
  };

  if (!paymentIntentId) {
    alert('unknown-payment', {});
    return;
  }

  // Gift card purchase?
  if (phase === 'opened') {
    const disabled = await disableGiftCardForPayment(
      paymentIntentId,
      'dispute'
    );
    if (disabled) {
      alert('gift-card', {
        giftCardId: disabled.id,
        cardDisabledNow: disabled.disabledNow,
        initialAmountCents: disabled.initialAmount,
        // Already spent before the dispute = the platform's real exposure.
        redeemedCents: disabled.initialAmount - disabled.balance,
        remainingBalanceCents: disabled.balance,
      });
      return;
    }
  } else {
    const giftCard = await db.giftCard.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { id: true, status: true, balance: true },
    });
    if (giftCard) {
      alert('gift-card', {
        giftCardId: giftCard.id,
        giftCardStatus: giftCard.status,
        remainingBalanceCents: giftCard.balance,
        // Won: the purchase stands — re-enable from the admin if the card
        // was disabled by this dispute.
        action: dispute.status === 'won' ? 'review_reenable' : 'none',
      });
      return;
    }
  }

  // Booking payment, or the no-show fee charged on a booking?
  const booking = await db.booking.findFirst({
    where: {
      OR: [
        { stripePaymentIntentId: paymentIntentId },
        { noShowFeeChargePaymentIntentId: paymentIntentId },
      ],
    },
    select: {
      id: true,
      reference: true,
      status: true,
      wineryId: true,
      stripePaymentIntentId: true,
    },
  });
  if (booking) {
    alert(
      booking.stripePaymentIntentId === paymentIntentId
        ? 'booking'
        : 'no-show-fee',
      {
        bookingId: booking.id,
        bookingRef: booking.reference,
        bookingStatus: booking.status,
        wineryId: booking.wineryId,
      }
    );
    return;
  }

  alert('unmatched-payment', {});
}

/**
 * `charge.refunded` — fired for EVERY refund on a charge: the app's own
 * (cancellation, admin, no-show revert) and the ones issued by hand from
 * the Stripe Dashboard, which the DB never heard about. `amount_refunded`
 * is cumulative, so the handler is a pure, monotonic sync:
 *
 *  - booking payment → `refundAmount` / `refundIssued` are raised to
 *    Stripe's truth (never lowered — an echo of our own refund is a
 *    no-op), so a later cancellation refunds only what is still due;
 *  - no-show fee fully refunded → marked refunded, so the statement stops
 *    counting it and a later revert does not try to refund it again;
 *  - gift card purchase fully refunded → the card is disabled (the money
 *    went back, the balance must not stay spendable).
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = paymentIntentIdOf(charge.payment_intent);
  if (!paymentIntentId) {
    logInfo('charge.refunded without a payment intent — ignored', {
      chargeId: charge.id,
    });
    return;
  }

  const booking = await db.booking.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, reference: true },
  });
  if (booking) {
    const outcome = await syncBookingRefundFromStripe({
      bookingId: booking.id,
      cardRefundedCents: charge.amount_refunded,
    });
    logInfo('charge.refunded — booking refund ledger checked', {
      action: 'handleChargeRefunded',
      bookingRef: booking.reference,
      cardRefundedCents: charge.amount_refunded,
      outcome,
    });
    return;
  }

  const noShowBooking = await db.booking.findFirst({
    where: { noShowFeeChargePaymentIntentId: paymentIntentId },
    select: { id: true, reference: true },
  });
  if (noShowBooking) {
    if (charge.refunded) {
      // Write-once: the app's own refund flow stores the real re_ id; this
      // only fills the gap left by a Dashboard refund.
      const marked = await db.booking.updateMany({
        where: {
          id: noShowBooking.id,
          noShowFeeChargeStatus: NoShowChargeStatus.CHARGED,
          noShowFeeRefundId: null,
        },
        data: {
          noShowFeeRefundId: `stripe:${charge.id}`,
          noShowFeeRefundedCents: charge.amount_refunded,
        },
      });
      logInfo('charge.refunded — no-show fee refund checked', {
        action: 'handleChargeRefunded',
        bookingRef: noShowBooking.reference,
        markedRefunded: marked.count === 1,
      });
    } else {
      logWarn('charge.refunded — PARTIAL no-show fee refund, not synced', {
        action: 'handleChargeRefunded',
        bookingRef: noShowBooking.reference,
        cardRefundedCents: charge.amount_refunded,
      });
    }
    return;
  }

  if (charge.refunded) {
    const disabled = await disableGiftCardForPayment(paymentIntentId, 'refund');
    if (disabled) {
      logWarn('charge.refunded — gift card purchase refunded, card disabled', {
        action: 'handleChargeRefunded',
        giftCardId: disabled.id,
        cardDisabledNow: disabled.disabledNow,
        redeemedCents: disabled.initialAmount - disabled.balance,
      });
      Sentry.captureMessage('gift card purchase refunded — card disabled', {
        level: 'warning',
        tags: { area: 'stripe-webhook', incident: 'gift-purchase-refunded' },
        extra: {
          giftCardId: disabled.id,
          paymentIntentId,
          redeemedCents: disabled.initialAmount - disabled.balance,
          remainingBalanceCents: disabled.balance,
        },
      });
      return;
    }
  }

  logInfo('charge.refunded — no booking or gift card for this payment', {
    action: 'handleChargeRefunded',
    paymentIntentId,
    fullyRefunded: charge.refunded,
  });
}
