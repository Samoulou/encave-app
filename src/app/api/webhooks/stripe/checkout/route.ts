import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import type Stripe from 'stripe';
import { getStripe, isStripeConfigured } from '@/server/stripe';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { BookingStatus } from '@prisma/client';
import {
  sendBookingConfirmationEmail,
  sendWinemakerNewBookingEmail,
} from '@/server/services/email.service';
import { logError, logInfo } from '@/lib/logger';
import { getPostHogServer } from '@/lib/posthog';

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
        logInfo('Unhandled checkout event type', { eventType: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logError('Error processing checkout webhook', error);
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
    logError('No bookingId in session metadata');
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
    logError('Booking not found', undefined, { bookingId });
    return;
  }

  // Already confirmed - skip (idempotency)
  if (booking.status === BookingStatus.CONFIRMED) {
    logInfo('Booking already confirmed, skipping', {
      bookingRef: booking.reference,
    });
    return;
  }

  // Only update if still pending payment
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    logInfo('Booking not pending payment, not updating', {
      bookingRef: booking.reference,
      status: booking.status,
    });
    return;
  }

  // Generate secure access token for email link
  // Store only the hash for security - the plaintext token is sent in emails
  const accessToken = crypto.randomBytes(32).toString('hex');
  const accessTokenHash = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex');

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

  logInfo('Booking confirmed via webhook', { bookingRef: booking.reference });

  // Track booking completion in PostHog (server-side)
  const posthogServer = getPostHogServer();
  if (posthogServer) {
    posthogServer.capture({
      distinctId: booking.visitorEmail,
      event: 'booking_completed',
      properties: {
        booking_id: booking.id,
        booking_reference: booking.reference,
        experience_id: booking.experienceId,
        experience_title: booking.experience.title,
        winery_id: booking.wineryId,
        winery_name: booking.winery.name,
        date: booking.date.toISOString(),
        time_slot: booking.timeSlot,
        guest_count: booking.guestCount,
        total_price_chf: booking.totalPrice / 100,
        platform_fee_chf: booking.platformFee / 100,
        winery_payout_chf: booking.wineryPayout / 100,
      },
    });
    await posthogServer.flush();
  }

  // Combine date and timeSlot for email formatting
  const [hours, minutes] = booking.timeSlot.split(':').map(Number);
  const bookingDateTime = new Date(booking.date);
  bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

  // Send confirmation email to visitor
  try {
    await sendBookingConfirmationEmail(booking.visitorEmail, {
      bookingId: booking.id,
      accessToken,
      guestName: booking.visitorName,
      experienceTitle: booking.experience.title,
      wineryName: booking.winery.name,
      date: bookingDateTime,
      guestCount: booking.guestCount,
      duration: booking.experience.duration,
      totalPrice: booking.totalPrice,
      bookingRef: booking.reference,
    });

    // Update confirmation sent timestamp
    await db.booking.update({
      where: { id: bookingId },
      data: { confirmationSentAt: new Date() },
    });

    logInfo('Confirmation email sent', {
      to: booking.visitorEmail,
      bookingRef: booking.reference,
    });
  } catch (error) {
    logError('Failed to send confirmation email', error, { bookingId });
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

    logInfo('Winery notification sent', {
      to: booking.winery.email,
      bookingRef: booking.reference,
    });
  } catch (error) {
    logError('Failed to send winery notification', error, { bookingId });
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
