import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Stripe from 'stripe';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { BookingStatus } from '@prisma/client';
import {
  sendBookingConfirmationEmail,
  sendWinemakerNewBookingEmail,
} from '@/server/services/email.service';

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
 * Updates booking status to CONFIRMED and sends confirmation emails
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
    include: {
      experience: {
        select: {
          title: true,
          duration: true,
        },
      },
      winery: {
        select: {
          name: true,
          email: true,
          user: {
            select: {
              name: true,
              preferredLocale: true,
            },
          },
        },
      },
    },
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

  // Generate secure access token for email link
  // Store only the hash for security - the plaintext token is sent in emails
  const accessToken = crypto.randomBytes(32).toString('hex');
  const accessTokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

  // Update booking to confirmed
  // Note: We only store the hash, not the plaintext token (SEC-002 fix)
  await db.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CONFIRMED,
      stripePaymentIntentId: session.payment_intent as string,
      expiresAt: null, // Clear expiration since payment is complete
      accessTokenHash,
    },
  });

  console.log(`Booking ${booking.reference} confirmed via webhook`);

  // Combine date and timeSlot for email formatting
  const [hours, minutes] = booking.timeSlot.split(':').map(Number);
  const bookingDateTime = new Date(booking.date);
  bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

  // Send confirmation email to visitor
  try {
    await sendBookingConfirmationEmail(
      booking.visitorEmail,
      {
        guestName: booking.visitorName,
        experienceTitle: booking.experience.title,
        wineryName: booking.winery.name,
        date: bookingDateTime,
        guestCount: booking.guestCount,
        duration: booking.experience.duration,
        totalPrice: booking.totalPrice,
        bookingRef: booking.reference,
      }
    );

    // Update confirmation sent timestamp
    await db.booking.update({
      where: { id: bookingId },
      data: { confirmationSentAt: new Date() },
    });

    console.log(`Confirmation email sent to ${booking.visitorEmail}`);
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    // Don't throw - booking is still confirmed, email failure is not critical
  }

  // Send notification to winery
  try {
    await sendWinemakerNewBookingEmail(
      booking.winery.email,
      {
        winemakerName: booking.winery.user.name ?? 'Winemaker',
        experienceTitle: booking.experience.title,
        date: bookingDateTime,
        guestCount: booking.guestCount,
        totalPrice: booking.wineryPayout, // Show payout amount, not total
        guestName: booking.visitorName,
        guestEmail: booking.visitorEmail,
        bookingRef: booking.reference,
      },
      booking.winery.user.preferredLocale
    );

    // Update winery notified timestamp
    await db.booking.update({
      where: { id: bookingId },
      data: { wineryNotifiedAt: new Date() },
    });

    console.log(`Winery notification sent to ${booking.winery.email}`);
  } catch (error) {
    console.error('Failed to send winery notification:', error);
    // Don't throw - booking is still confirmed
  }
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
