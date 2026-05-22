import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, isStripeConfigured } from '@/server/stripe';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { BookingStatus, Prisma } from '@prisma/client';
import { confirmBookingFromPaidCheckoutSession } from '@/server/services/checkout-confirmation.service';
import { logError, logInfo } from '@/lib/logger';

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
      case 'checkout.session.completed': {
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

async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await db.stripeEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        status: 'PROCESSING',
      },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await db.stripeEvent.findUnique({
        where: { stripeEventId: event.id },
        select: { status: true },
      });

      if (existing?.status === 'FAILED') {
        const retry = await db.stripeEvent.updateMany({
          where: { stripeEventId: event.id, status: 'FAILED' },
          data: { status: 'PROCESSING', errorMessage: null },
        });
        return retry.count === 1;
      }

      logInfo('Duplicate Stripe checkout event skipped', {
        eventId: event.id,
        eventType: event.type,
        status: existing?.status,
      });
      return false;
    }

    throw error;
  }
}

async function markStripeEventProcessed(eventId: string): Promise<void> {
  await db.stripeEvent.update({
    where: { stripeEventId: eventId },
    data: { status: 'PROCESSED', errorMessage: null },
  });
}

async function markStripeEventFailed(
  eventId: string,
  error: unknown
): Promise<void> {
  await db.stripeEvent.update({
    where: { stripeEventId: eventId },
    data: {
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    },
  });
}

/**
 * Handle checkout.session.completed event
 * Updates booking status to CONFIRMED and sends confirmation emails
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const result = await confirmBookingFromPaidCheckoutSession(
    session,
    'webhook'
  );

  if (result === 'missing_payment_intent') {
    throw new Error('Checkout session has no payment intent');
  }
}

/**
 * Handle checkout.session.expired event
 * Cancels the pending booking
 */
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    logError('No bookingId in session metadata');
    return;
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, reference: true },
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

  // Delete the pending booking to free up capacity
  await db.booking.delete({
    where: { id: bookingId },
  });

  logInfo('Booking deleted due to checkout session expiry', {
    bookingRef: booking.reference,
  });
}
