'use server';

import { z } from 'zod';
import { differenceInHours } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { db } from '@/server/db';
import { auth } from '@/server/auth';
import { BookingStatus, Locale } from '@prisma/client';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';
import { processRefund } from '@/server/services/payment.service';
import { computeBookingRefund } from '@/lib/business-rules/cancellation-policy';
import {
  sendBookingCancellationEmail,
  sendWinemakerCancellationEmail,
} from '@/server/services/email.service';

export interface ClientCancellationResult {
  bookingId: string;
  status: BookingStatus;
  refundIssued: boolean;
  refundAmount: number | null;
}

/**
 * Cancel a booking as the authenticated client.
 * Verifies the user's email matches the booking's visitorEmail.
 * Refund follows the winery's cancellation policy (P-03 / L-043).
 */
export async function cancelClientBooking(
  bookingId: string
): Promise<ActionResult<ClientCancellationResult>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    // Find booking and verify ownership by email
    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        visitorEmail: { equals: session.user.email, mode: 'insensitive' },
      },
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
            cancellationPolicy: true,
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
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only confirmed bookings can be cancelled',
        },
      };
    }

    // Calculate hours until experience
    const [hours, minutes] = booking.timeSlot.split(':').map(Number);
    const experienceDateTime = new Date(booking.date);
    experienceDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

    const hoursUntilExperience = differenceInHours(
      experienceDateTime,
      new Date()
    );

    if (hoursUntilExperience < 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot cancel a past booking',
        },
      };
    }

    // Refund per the policy snapshotted at booking (fallback: winery's
    // current policy for legacy rows) on the full paid amount (D2).
    const { paidCents, refundDueCents, stripeAmountArg } = computeBookingRefund(
      booking,
      hoursUntilExperience
    );
    let refundAmount: number | null = null;
    let stripeRefundId: string | null = null;

    // Atomic claim — see cancelBooking: prevents two concurrent
    // cancellations from both obtaining a partial refund.
    const claimed = await db.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.CONFIRMED },
      data: {
        status: BookingStatus.CANCELLED_BY_CLIENT,
        cancelledAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only confirmed bookings can be cancelled',
        },
      };
    }

    if (refundDueCents > 0 && booking.stripePaymentIntentId) {
      try {
        const refundResult = await processRefund(
          booking.stripePaymentIntentId,
          true,
          stripeAmountArg,
          `cancel-refund:${bookingId}:${refundDueCents}`
        );
        refundAmount = refundResult.amount;
        stripeRefundId = refundResult.refundId;
      } catch (refundError) {
        // Release the claim ONLY on a deterministic Stripe rejection —
        // after an ambiguous network error the refund may have succeeded,
        // and releasing would allow a second one once the idempotency key
        // expires (24h). Ambiguous → keep the cancellation, store the
        // error for manual reconciliation.
        const deterministic =
          typeof refundError === 'object' &&
          refundError !== null &&
          'type' in refundError &&
          refundError.type === 'StripeInvalidRequestError';
        if (deterministic) {
          await db.booking.updateMany({
            where: {
              id: bookingId,
              status: BookingStatus.CANCELLED_BY_CLIENT,
            },
            data: { status: BookingStatus.CONFIRMED, cancelledAt: null },
          });
        } else {
          await db.booking.update({
            where: { id: bookingId },
            data: { refundError: String(refundError) },
          });
        }
        logError('Refund processing error', refundError, {
          action: 'cancelClientBooking',
          bookingId,
        });
        return {
          success: false,
          error: {
            code: 'PAYMENT_FAILED',
            message:
              'Failed to process refund. Please try again or contact support.',
          },
        };
      }
    }

    // Record the refund outcome on the already-cancelled booking
    const updatedBooking = await db.booking.update({
      where: { id: bookingId },
      data: {
        refundIssued: refundAmount !== null,
        refundAmount,
        stripeRefundId,
      },
    });

    // Combine date and timeSlot for email formatting
    const bookingDateTime = new Date(booking.date);
    bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

    // Send cancellation email to client (full paid total; refund exact,
    // or generic wording when due but unprocessable — see cancelBooking).
    if (refundDueCents > 0 && refundAmount === null) {
      logError(
        'Refund due but no Stripe payment intent on booking',
        undefined,
        { action: 'cancelClientBooking', bookingId, refundDueCents }
      );
    }
    await sendBookingCancellationEmail(booking.visitorEmail, {
      guestName: booking.visitorName,
      experienceTitle: booking.experience.title,
      wineryName: booking.winery.name,
      date: bookingDateTime,
      totalPrice: paidCents,
      refundAmountCents:
        refundDueCents > 0 && refundAmount === null
          ? null
          : (refundAmount ?? 0),
      bookingRef: booking.reference,
    });

    // Send notification to winemaker
    await sendWinemakerCancellationEmail(
      booking.winery.email,
      {
        winemakerName: booking.winery.user?.name ?? 'Winemaker',
        experienceTitle: booking.experience.title,
        date: bookingDateTime,
        guestCount: booking.guestCount,
        guestName: booking.visitorName,
        bookingRef: booking.reference,
      },
      booking.winery.user?.preferredLocale
    );

    revalidatePath('/dashboard/my-bookings');

    return {
      success: true,
      data: {
        bookingId: updatedBooking.id,
        status: updatedBooking.status,
        refundIssued: refundAmount !== null,
        refundAmount,
      },
    };
  } catch (error) {
    logError('cancelClientBooking error', error, {
      action: 'cancelClientBooking',
      bookingId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel booking' },
    };
  }
}

const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  preferredLocale: z.nativeEnum(Locale),
});

/**
 * Update the authenticated client's profile (name and preferred locale).
 */
export async function updateClientProfile(
  input: z.infer<typeof UpdateProfileSchema>
): Promise<ActionResult<{ name: string; preferredLocale: Locale }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    const validated = UpdateProfileSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      };
    }

    const { name, preferredLocale } = validated.data;

    await db.user.update({
      where: { id: session.user.id },
      data: { name, preferredLocale },
    });

    revalidatePath('/dashboard/profile');

    return {
      success: true,
      data: { name, preferredLocale },
    };
  } catch (error) {
    logError('updateClientProfile error', error, {
      action: 'updateClientProfile',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' },
    };
  }
}
