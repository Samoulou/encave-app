import { addMinutes, isBefore } from 'date-fns';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { sendBookingExpiredEmail } from '@/server/services/email.service';

const PAYMENT_EXPIRATION_MINUTES = 30;

export async function expirePendingPaymentBookings(now = new Date()): Promise<{
  expired: number;
}> {
  const candidates = await db.booking.findMany({
    where: {
      status: BookingStatus.PENDING_PAYMENT,
      createdAt: { lt: addMinutes(now, -PAYMENT_EXPIRATION_MINUTES) },
    },
    select: {
      id: true,
      reference: true,
      visitorEmail: true,
      visitorName: true,
      createdAt: true,
      stripeCheckoutSessionId: true,
      date: true,
      experience: {
        select: {
          title: true,
          slug: true,
        },
      },
    },
    take: 100,
  });

  let expired = 0;
  for (const candidate of candidates) {
    if (!isBefore(addMinutes(candidate.createdAt, 30), now)) continue;

    try {
      // Ask Stripe BEFORE cancelling: a paid session whose
      // checkout.session.completed webhook is late must NOT be expired
      // locally — the webhook will confirm it. Cancelling first would
      // strand a captured payment on a cancelled booking.
      if (candidate.stripeCheckoutSessionId?.startsWith('cs_')) {
        let checkoutSession;
        try {
          checkoutSession = await getStripe().checkout.sessions.retrieve(
            candidate.stripeCheckoutSessionId
          );
        } catch (error) {
          logWarn('Could not retrieve Checkout Session — retrying next run', {
            action: 'expirePendingPaymentBookings',
            bookingId: candidate.id,
            error: String(error),
          });
          continue;
        }
        if (checkoutSession.payment_status !== 'unpaid') {
          logWarn(
            'Session paid but booking still pending — leaving to webhook',
            {
              action: 'expirePendingPaymentBookings',
              bookingId: candidate.id,
              paymentStatus: checkoutSession.payment_status,
            }
          );
          continue;
        }
      }

      const updated = await db.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({
          where: { id: candidate.id },
          select: { status: true },
        });

        if (!current || current.status !== BookingStatus.PENDING_PAYMENT) {
          return false;
        }

        await tx.booking.update({
          where: { id: candidate.id },
          data: {
            status: BookingStatus.CANCELLED_BY_CLIENT,
            cancelledAt: now,
            cancellationReason: 'PAYMENT_EXPIRED',
          },
        });
        return true;
      });

      if (!updated) continue;

      if (candidate.stripeCheckoutSessionId?.startsWith('cs_')) {
        try {
          await getStripe().checkout.sessions.expire(
            candidate.stripeCheckoutSessionId
          );
        } catch (error) {
          logWarn('Failed to expire Stripe Checkout session', {
            action: 'expirePendingPaymentBookings',
            bookingId: candidate.id,
            error: String(error),
          });
        }
      }

      await sendBookingExpiredEmail(candidate.visitorEmail, {
        guestName: candidate.visitorName,
        experienceTitle: candidate.experience.title,
        experienceSlug: candidate.experience.slug,
        date: candidate.date,
      });
      expired++;
    } catch (error) {
      logError('Failed to expire pending booking', error, {
        action: 'expirePendingPaymentBookings',
        bookingId: candidate.id,
      });
    }
  }

  logInfo('booking.pending_payment.expired', { expired });
  return { expired };
}
