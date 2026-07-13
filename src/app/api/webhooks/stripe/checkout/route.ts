import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, isStripeConfigured } from '@/server/stripe';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { BookingStatus } from '@prisma/client';
import { confirmBookingFromPaidCheckoutSession } from '@/server/services/checkout-confirmation.service';
import { createGiftCardFromPayment } from '@/server/services/giftCard.service';
import { settleGiftTransfer } from '@/server/services/giftCard-transfer.service';
import { releaseGiftForBooking } from '@/server/services/giftCard-redemption.service';
import { flipRequestOfferPaid } from '@/server/services/request.service';
import { logError, logInfo } from '@/lib/logger';
import {
  claimStripeEvent,
  markStripeEventFailed,
  markStripeEventProcessed,
} from '@/server/services/stripe-event.service';

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

  const shouldProcess = await claimStripeEvent(event);
  if (!shouldProcess) {
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
    }
    return;
  }

  const { result } = await confirmBookingFromPaidCheckoutSession(
    session,
    'webhook'
  );

  if (result === 'missing_payment_intent') {
    throw new Error('Checkout session has no payment intent');
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
    },
  });

  if (!booking) {
    logError('Booking not found', undefined, { bookingId });
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

  // Return any gift-card funds reserved on this booking BEFORE deleting it
  // (P-09, Luca §4) — idempotent, no-op when no gift was applied.
  await releaseGiftForBooking(bookingId);

  // Delete the pending booking to free up capacity
  await db.booking.delete({
    where: { id: bookingId },
  });

  logInfo('Booking deleted due to checkout session expiry', {
    bookingRef: booking.reference,
  });
}
