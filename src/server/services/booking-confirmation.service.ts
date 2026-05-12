/**
 * ENC-067 — Shared service for confirming a booking from a Stripe Checkout Session.
 *
 * Extracted from the webhook handler so that both the webhook and the
 * synchronous fallback (reconcileBookingPayment) can flip a booking from
 * PENDING_PAYMENT → CONFIRMED through a single code path.
 *
 * Idempotence is enforced at the DB level via an `updateMany` conditioned on
 * `status: 'PENDING_PAYMENT'`. Only one caller observes `count === 1` and
 * triggers the side-effects (emails, PostHog, cache invalidation). The race
 * loser observes `count === 0` and is a strict no-op.
 */

import crypto from 'crypto';
import { revalidateTag } from 'next/cache';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import {
  sendBookingConfirmationEmail,
  sendWinemakerNewBookingEmail,
} from '@/server/services/email.service';
import { logError, logInfo } from '@/lib/logger';
import { getPostHogServer } from '@/lib/posthog';

export type ConfirmationSource = 'WEBHOOK' | 'RECONCILE' | 'CRON';

export interface ConfirmBookingFromCheckoutSessionInput {
  bookingId: string;
  stripeSessionId: string;
  stripePaymentIntentId: string;
  source: ConfirmationSource;
}

export interface ConfirmBookingFromCheckoutSessionResult {
  /** true if THIS call performed the transition (count === 1). */
  confirmed: boolean;
  /** true if the booking was already confirmed (or another caller won the race). */
  alreadyConfirmed: boolean;
}

/**
 * Confirm a booking from a Stripe Checkout Session, idempotently.
 *
 * Behaviour:
 * - Atomic flip via `updateMany({ where: { id, status: PENDING_PAYMENT } })`.
 * - If `count === 1` (we won): generate access token hash, send emails,
 *   capture PostHog, invalidate caches.
 * - If `count === 0` (someone else won, or booking not in PENDING_PAYMENT):
 *   no-op, return `{ confirmed: false, alreadyConfirmed: true }`.
 *
 * Email failures are logged but never throw — the booking stays CONFIRMED.
 */
export async function confirmBookingFromCheckoutSession(
  input: ConfirmBookingFromCheckoutSessionInput
): Promise<ConfirmBookingFromCheckoutSessionResult> {
  const { bookingId, stripeSessionId, stripePaymentIntentId, source } = input;

  // Generate access token hash (plaintext is never persisted — SEC-002).
  // We compute it before the updateMany so we can store it atomically with
  // the status transition.
  const accessToken = crypto.randomBytes(32).toString('hex');
  const accessTokenHash = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex');

  // Atomic conditional update — only the caller observing count === 1 owns
  // the side-effects below. This is our race protection vs concurrent
  // webhook/reconcile/cron callers.
  const updateResult = await db.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.PENDING_PAYMENT,
    },
    data: {
      status: BookingStatus.CONFIRMED,
      stripePaymentIntentId,
      expiresAt: null,
      accessTokenHash,
    },
  });

  if (updateResult.count === 0) {
    logInfo('Booking confirmation no-op (already confirmed by other source)', {
      bookingId,
      stripeSessionId,
      source,
    });
    return { confirmed: false, alreadyConfirmed: true };
  }

  // We own the transition — load full booking for side-effects.
  // `confirmationSentAt` and `wineryNotifiedAt` are pulled to enforce a
  // second idempotence layer at the email step (cf. ENC-067 review H1):
  // belt-and-braces protection against any future code path that could
  // re-enter this service for the same booking outside of the updateMany
  // guard above.
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      experience: {
        select: {
          title: true,
          slug: true,
          duration: true,
        },
      },
      winery: {
        select: {
          name: true,
          slug: true,
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
    // Extremely unlikely: row was updated but disappeared. Log and bail.
    logError(
      'Booking vanished after successful confirmation update',
      undefined,
      {
        bookingId,
        source,
      }
    );
    return { confirmed: true, alreadyConfirmed: false };
  }

  logInfo('Booking confirmed', {
    bookingRef: booking.reference,
    bookingId: booking.id,
    source,
    stripeSessionId,
  });

  // Cache invalidation — granular, tag-only (per CLAUDE.md / ADR-0002).
  revalidateTag(`booking:${booking.id}`);
  revalidateTag(`booking:winery:${booking.winery.slug}`);
  revalidateTag(`experience:${booking.experience.slug}:availability`);

  // PostHog server-side capture.
  const posthogServer = getPostHogServer();
  if (posthogServer) {
    try {
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
          confirmation_source: source,
        },
      });
      await posthogServer.flush();
    } catch (error) {
      logError('PostHog capture failed (non-fatal)', error, {
        bookingId,
        source,
      });
    }
  }

  // Build the combined date+time for emails.
  const [hoursStr, minutesStr] = booking.timeSlot.split(':');
  const hours = Number(hoursStr ?? 0);
  const minutes = Number(minutesStr ?? 0);
  const bookingDateTime = new Date(booking.date);
  bookingDateTime.setHours(hours, minutes, 0, 0);

  // Send client confirmation email — gated by `confirmationSentAt` to enforce
  // single-send even if the service is somehow re-entered for the same row
  // (ENC-067 review H1 — belt-and-braces vs the updateMany guard above).
  if (!booking.confirmationSentAt) {
    try {
      const sent = await sendBookingConfirmationEmail(booking.visitorEmail, {
        guestName: booking.visitorName,
        experienceTitle: booking.experience.title,
        wineryName: booking.winery.name,
        date: bookingDateTime,
        guestCount: booking.guestCount,
        duration: booking.experience.duration,
        totalPrice: booking.totalPrice,
        bookingRef: booking.reference,
      });

      if (sent) {
        await db.booking.update({
          where: { id: bookingId },
          data: { confirmationSentAt: new Date() },
        });
        // PII-safe log — bookingRef alone is enough for debug (cf. M1).
        logInfo('Confirmation email sent', {
          bookingRef: booking.reference,
          source,
        });
      }
    } catch (error) {
      logError('Failed to send confirmation email', error, {
        bookingId,
        source,
      });
      // Don't throw — booking is still CONFIRMED.
    }
  } else {
    logInfo('Confirmation email skipped (already sent)', {
      bookingRef: booking.reference,
      source,
    });
  }

  // Send winemaker notification — same idempotence guard via `wineryNotifiedAt`.
  if (!booking.wineryNotifiedAt) {
    try {
      const sent = await sendWinemakerNewBookingEmail(
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

      if (sent) {
        await db.booking.update({
          where: { id: bookingId },
          data: { wineryNotifiedAt: new Date() },
        });
        // PII-safe log — bookingRef alone is enough for debug (cf. M1).
        logInfo('Winery notification sent', {
          bookingRef: booking.reference,
          source,
        });
      }
    } catch (error) {
      logError('Failed to send winery notification', error, {
        bookingId,
        source,
      });
    }
  } else {
    logInfo('Winery notification skipped (already sent)', {
      bookingRef: booking.reference,
      source,
    });
  }

  return { confirmed: true, alreadyConfirmed: false };
}
