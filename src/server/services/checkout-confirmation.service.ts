import crypto from 'crypto';
import type Stripe from 'stripe';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import {
  sendBookingConfirmationEmail,
  sendWinemakerNewBookingEmail,
} from '@/server/services/email.service';
import { logError, logInfo } from '@/lib/logger';
import { getPostHogServer } from '@/lib/posthog';

export type CheckoutConfirmationSource = 'webhook' | 'confirmation_page';

export type CheckoutConfirmationResult =
  | 'confirmed'
  | 'already_confirmed'
  | 'not_paid'
  | 'not_pending'
  | 'missing_booking'
  | 'missing_metadata'
  | 'session_mismatch'
  | 'missing_payment_intent'
  | 'race_lost';

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (!session.payment_intent) {
    return null;
  }

  if (typeof session.payment_intent === 'string') {
    return session.payment_intent;
  }

  return session.payment_intent.id;
}

/**
 * Confirms a pending booking only when Stripe says the Checkout Session is paid.
 * The status update is guarded by PENDING_PAYMENT so webhook/page races remain
 * idempotent and only the winning caller sends confirmation notifications.
 */
export async function confirmBookingFromPaidCheckoutSession(
  session: Stripe.Checkout.Session,
  source: CheckoutConfirmationSource = 'webhook'
): Promise<CheckoutConfirmationResult> {
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    logError('No bookingId in session metadata');
    return 'missing_metadata';
  }

  if (session.payment_status !== 'paid') {
    logInfo('Checkout session is not paid, booking not confirmed', {
      bookingId,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      source,
    });
    return 'not_paid';
  }

  const paymentIntentId = getPaymentIntentId(session);
  if (!paymentIntentId) {
    logError('Checkout session has no payment intent', undefined, {
      bookingId,
      sessionId: session.id,
      source,
    });
    return 'missing_payment_intent';
  }

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
    logError('Booking not found', undefined, { bookingId, source });
    return 'missing_booking';
  }

  if (
    booking.stripeCheckoutSessionId &&
    booking.stripeCheckoutSessionId !== session.id
  ) {
    logError('Checkout session does not match booking', undefined, {
      bookingId,
      bookingSessionId: booking.stripeCheckoutSessionId,
      sessionId: session.id,
      source,
    });
    return 'session_mismatch';
  }

  if (booking.status === BookingStatus.CONFIRMED) {
    logInfo('Booking already confirmed, skipping', {
      bookingRef: booking.reference,
      source,
    });
    return 'already_confirmed';
  }

  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    logInfo('Booking not pending payment, not updating', {
      bookingRef: booking.reference,
      status: booking.status,
      source,
    });
    return 'not_pending';
  }

  const accessToken = crypto.randomBytes(32).toString('hex');
  const accessTokenHash = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex');

  const updated = await db.booking.updateMany({
    where: { id: bookingId, status: BookingStatus.PENDING_PAYMENT },
    data: {
      status: BookingStatus.CONFIRMED,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      expiresAt: null,
      accessTokenHash,
    },
  });

  if (updated.count !== 1) {
    logInfo('Booking no longer pending payment after confirmation claim', {
      bookingRef: booking.reference,
      source,
    });
    return 'race_lost';
  }

  logInfo('Booking confirmed from paid checkout session', {
    bookingRef: booking.reference,
    source,
  });

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

  const [hours, minutes] = booking.timeSlot.split(':').map(Number);
  const bookingDateTime = new Date(booking.date);
  bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

  try {
    await sendBookingConfirmationEmail(
      booking.visitorEmail,
      {
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
      },
      booking.winery.user.preferredLocale
    );

    await db.booking.update({
      where: { id: bookingId },
      data: { confirmationSentAt: new Date() },
    });

    logInfo('Confirmation email sent', {
      to: booking.visitorEmail,
      bookingRef: booking.reference,
      source,
    });
  } catch (error) {
    logError('Failed to send confirmation email', error, { bookingId, source });
  }

  try {
    await sendWinemakerNewBookingEmail(
      booking.winery.email,
      {
        winemakerName: booking.winery.user.name ?? 'Winemaker',
        experienceTitle: booking.experience.title,
        date: bookingDateTime,
        guestCount: booking.guestCount,
        totalPrice: booking.wineryPayout,
        guestName: booking.visitorName,
        guestEmail: booking.visitorEmail,
        bookingRef: booking.reference,
      },
      booking.winery.user.preferredLocale
    );

    await db.booking.update({
      where: { id: bookingId },
      data: { wineryNotifiedAt: new Date() },
    });

    logInfo('Winery notification sent', {
      to: booking.winery.email,
      bookingRef: booking.reference,
      source,
    });
  } catch (error) {
    logError('Failed to send winery notification', error, {
      bookingId,
      source,
    });
  }

  return 'confirmed';
}
