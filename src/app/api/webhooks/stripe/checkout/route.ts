import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { BookingStatus } from '@prisma/client';

// Initialize Stripe
const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { typescript: true })
  : null;

export async function POST(req: Request) {
  if (!stripe) {
    console.error('Stripe is not configured');
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    );
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', errorMessage);
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    );
  }

  // Handle the event
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
        console.log(`Unhandled checkout event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing checkout webhook:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed event
 * Updates booking status to CONFIRMED
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    console.error('No bookingId in session metadata');
    return;
  }

  // Idempotency check - ensure we don't process twice
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, reference: true },
  });

  if (!booking) {
    console.error(`Booking not found: ${bookingId}`);
    return;
  }

  // Already confirmed - skip (idempotency)
  if (booking.status === BookingStatus.CONFIRMED) {
    console.log(`Booking ${booking.reference} already confirmed, skipping`);
    return;
  }

  // Only update if still pending payment
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    console.log(`Booking ${booking.reference} is ${booking.status}, not updating`);
    return;
  }

  // Update booking to confirmed
  await db.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CONFIRMED,
      stripePaymentIntentId: session.payment_intent as string,
      expiresAt: null, // Clear expiration since payment is complete
    },
  });

  console.log(`Booking ${booking.reference} confirmed via webhook`);

  // TODO: Send confirmation email to visitor
  // TODO: Send notification to winery
}

/**
 * Handle checkout.session.expired event
 * Cancels the pending booking
 */
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    console.error('No bookingId in session metadata');
    return;
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, reference: true },
  });

  if (!booking) {
    console.error(`Booking not found: ${bookingId}`);
    return;
  }

  // Only cancel if still pending
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    console.log(`Booking ${booking.reference} is ${booking.status}, not cancelling`);
    return;
  }

  // Delete the pending booking to free up capacity
  await db.booking.delete({
    where: { id: bookingId },
  });

  console.log(`Booking ${booking.reference} deleted due to checkout session expiry`);
}
