'use server';

import { z } from 'zod';
import crypto from 'crypto';
import { differenceInHours } from 'date-fns';
import { db } from '@/server/db';
import type { ActionResult } from '@/types/actions';
import { BookingStatus } from '@prisma/client';
import type { CancellationPolicy, ExperiencePaymentMode } from '@prisma/client';
import {
  sendBookingCancellationEmail,
  sendWinemakerCancellationEmail,
} from '@/server/services/email.service';
import {
  appendRefundError,
  processCancellationRefund,
} from '@/server/services/booking-refund.service';
import {
  computeBookingRefund,
  computeRefundCents,
} from '@/lib/business-rules/cancellation-policy';
import {
  activeCapacityBookingWhere,
  resolveOccurrenceCapacity,
} from '@/lib/business-rules/capacity';
import { calculateEndTime } from '@/lib/constants/time-slots';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { OccurrenceStatus } from '@prisma/client';
import { logError, logWarn } from '@/lib/logger';

const CheckAvailabilitySchema = z.object({
  experienceId: z.string(),
  date: z.string(),
  timeSlot: z.string(),
  /**
   * The caller's own hold (P-04 / L-050): the checkout page must not
   * count the seats its visitor already reserved as competing demand —
   * without this, booking the last free seats self-disables the form.
   * Read-only distortion at worst; the transactional capacity checks at
   * claim/create never exclude anything.
   */
  excludeBookingId: z.string().cuid().optional(),
});

export interface AvailabilityResult {
  available: boolean;
  remainingCapacity: number;
  maxCapacity: number;
  bookedCount: number;
}

export async function checkAvailability(
  input: z.infer<typeof CheckAvailabilitySchema>
): Promise<ActionResult<AvailabilityResult>> {
  try {
    const validated = CheckAvailabilitySchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      };
    }

    const { experienceId, date, timeSlot, excludeBookingId } = validated.data;

    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      select: { maxCapacity: true },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    // Parse date string to Date object for comparison
    const bookingDate = new Date(date);

    // Occurrence-aware capacity (P-05 / ADR-0002): the occurrence
    // contributes the capacity NUMBER (override ?? max) and the OPEN /
    // blackout gate; a slot without an occurrence keeps the legacy
    // maxCapacity (defensive union — resolve materializes at hold time).
    let slotCapacity = experience.maxCapacity;
    let slotOpen = true;
    if (await isFlagEnabled('OCCURRENCE_CAPACITY')) {
      const [blocked, occurrence] = await Promise.all([
        db.blockedDate.findUnique({
          where: { experienceId_date: { experienceId, date: bookingDate } },
          select: { id: true },
        }),
        db.experienceOccurrence.findUnique({
          where: {
            experienceId_date_startTime: {
              experienceId,
              date: bookingDate,
              startTime: timeSlot,
            },
          },
          select: { status: true, capacityOverride: true },
        }),
      ]);
      if (blocked) {
        slotOpen = false;
      } else if (occurrence) {
        slotOpen = occurrence.status === OccurrenceStatus.OPEN;
        slotCapacity = resolveOccurrenceCapacity(
          occurrence.capacityOverride,
          experience.maxCapacity
        );
      }
    }

    // Get total booked guests for this slot
    const bookedGuests = await db.booking.aggregate({
      where: {
        experienceId,
        date: bookingDate,
        timeSlot,
        // Logical hold release (L-050): expired holds free the capacity.
        ...activeCapacityBookingWhere(),
        ...(excludeBookingId !== undefined
          ? { id: { not: excludeBookingId } }
          : {}),
      },
      _sum: { guestCount: true },
    });

    const bookedCount = bookedGuests._sum.guestCount ?? 0;
    const remainingCapacity = slotOpen
      ? Math.max(0, slotCapacity - bookedCount)
      : 0;

    return {
      success: true,
      data: {
        available: remainingCapacity > 0,
        remainingCapacity,
        maxCapacity: slotCapacity,
        bookedCount,
      },
    };
  } catch (error) {
    logError('checkAvailability error', error, { action: 'checkAvailability' });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check availability',
      },
    };
  }
}

export interface TimeSlotAvailability {
  timeSlot: string;
  endTime: string;
  remainingCapacity: number;
  maxCapacity: number;
  available: boolean;
}

export async function getTimeSlotsForDate(
  experienceId: string,
  date: string
): Promise<ActionResult<TimeSlotAvailability[]>> {
  try {
    const bookingDate = new Date(date);
    const dayOfWeek = bookingDate.getDay();

    // Get experience with its availability slots for this day
    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      include: {
        availabilitySlots: {
          where: {
            dayOfWeek,
            isActive: true,
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    const occurrenceCapacityOn = await isFlagEnabled('OCCURRENCE_CAPACITY');

    // Blackout gate (P-05 / ADR-0002 D3): a blocked date offers no slot.
    // Fixes the pre-existing bug where public availability ignored
    // BlockedDate entirely.
    if (occurrenceCapacityOn) {
      const blocked = await db.blockedDate.findUnique({
        where: { experienceId_date: { experienceId, date: bookingDate } },
        select: { id: true },
      });
      if (blocked) return { success: true, data: [] };
    }

    // Get all bookings for this date
    const bookings = await db.booking.groupBy({
      by: ['timeSlot'],
      where: {
        experienceId,
        date: bookingDate,
        // Logical hold release (L-050): expired holds free the capacity.
        ...activeCapacityBookingWhere(),
      },
      _sum: { guestCount: true },
    });

    const bookingsBySlot = new Map(
      bookings.map((b) => [b.timeSlot, b._sum.guestCount ?? 0])
    );

    // Occurrence layer (P-05): occurrences drive status + capacity and
    // surface PUNCTUAL slots that no weekly pattern covers. Weekly slots
    // without an occurrence keep the legacy behavior (defensive union —
    // the occurrence materializes at hold time).
    const occurrences = occurrenceCapacityOn
      ? await db.experienceOccurrence.findMany({
          where: { experienceId, date: bookingDate },
          select: { startTime: true, status: true, capacityOverride: true },
        })
      : [];
    const occurrenceBySlot = new Map(occurrences.map((o) => [o.startTime, o]));

    const bySlot = new Map<string, TimeSlotAvailability>();
    for (const slot of experience.availabilitySlots) {
      const occurrence = occurrenceBySlot.get(slot.startTime);
      const open = !occurrence || occurrence.status === OccurrenceStatus.OPEN;
      const capacity = occurrence
        ? resolveOccurrenceCapacity(
            occurrence.capacityOverride,
            experience.maxCapacity
          )
        : experience.maxCapacity;
      const bookedCount = bookingsBySlot.get(slot.startTime) ?? 0;
      const remainingCapacity = open ? Math.max(0, capacity - bookedCount) : 0;
      bySlot.set(slot.startTime, {
        timeSlot: slot.startTime,
        endTime: slot.endTime,
        remainingCapacity,
        maxCapacity: capacity,
        available: remainingCapacity > 0,
      });
    }
    // PUNCTUAL (or straggler) occurrences with no weekly slot behind them.
    for (const occurrence of occurrences) {
      if (bySlot.has(occurrence.startTime)) continue;
      const open = occurrence.status === OccurrenceStatus.OPEN;
      const capacity = resolveOccurrenceCapacity(
        occurrence.capacityOverride,
        experience.maxCapacity
      );
      const bookedCount = bookingsBySlot.get(occurrence.startTime) ?? 0;
      const remainingCapacity = open ? Math.max(0, capacity - bookedCount) : 0;
      bySlot.set(occurrence.startTime, {
        timeSlot: occurrence.startTime,
        endTime: calculateEndTime(occurrence.startTime, experience.duration),
        remainingCapacity,
        maxCapacity: capacity,
        available: remainingCapacity > 0,
      });
    }

    const slots: TimeSlotAvailability[] = Array.from(bySlot.values()).sort(
      (a, b) => a.timeSlot.localeCompare(b.timeSlot)
    );

    return { success: true, data: slots };
  } catch (error) {
    logError('getTimeSlotsForDate error', error, {
      action: 'getTimeSlotsForDate',
      experienceId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get time slots' },
    };
  }
}

export interface ExperienceForBooking {
  id: string;
  title: string;
  slug: string;
  price: number;
  minCapacity: number;
  maxCapacity: number;
  duration: number;
  coverPhoto: string;
  /** P-08: ONLINE (paid at checkout) vs ON_SITE (free / pay-on-site). */
  paymentMode: ExperiencePaymentMode;
  winery: {
    id: string;
    name: string;
    commune: string | null;
    stripeOnboardingComplete: boolean;
    cancellationPolicy: CancellationPolicy;
    noShowFeeEnabled: boolean;
    noShowFeeCents: number;
  };
  availabilitySlots: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
}

export async function getExperienceForBooking(
  slug: string
): Promise<ActionResult<ExperienceForBooking>> {
  try {
    const experience = await db.experience.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        winery: { status: 'VERIFIED' },
      },
      include: {
        winery: {
          select: {
            id: true,
            name: true,
            commune: true,
            stripeOnboardingComplete: true,
            cancellationPolicy: true,
            noShowFeeEnabled: true,
            noShowFeeCents: true,
          },
        },
        availabilitySlots: {
          where: { isActive: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    return {
      success: true,
      data: {
        id: experience.id,
        title: experience.title,
        slug: experience.slug,
        price: experience.price,
        minCapacity: experience.minCapacity,
        maxCapacity: experience.maxCapacity,
        duration: experience.duration,
        coverPhoto: experience.coverPhoto,
        paymentMode: experience.paymentMode,
        winery: experience.winery,
        availabilitySlots: experience.availabilitySlots,
      },
    };
  } catch (error) {
    logError('getExperienceForBooking error', error, {
      action: 'getExperienceForBooking',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get experience' },
    };
  }
}

/**
 * Get booking by access token (for email links)
 */
export async function getBookingByToken(token: string): Promise<
  ActionResult<{
    id: string;
    reference: string;
    status: BookingStatus;
    visitorName: string;
    visitorEmail: string;
    visitorPhone: string;
    date: Date;
    timeSlot: string;
    guestCount: number;
    totalPrice: number;
    serviceFeeCents: number;
    experience: {
      title: string;
      slug: string;
      duration: number;
      coverPhoto: string;
    };
    winery: {
      name: string;
      slug: string;
      address: string;
      commune: string;
      phone: string;
      email: string;
    };
  }>
> {
  try {
    // Hash the token to compare with stored hash (SEC-002: plaintext token no longer stored)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const booking = await db.booking.findFirst({
      where: {
        accessTokenHash: tokenHash,
      },
      include: {
        experience: {
          select: {
            title: true,
            slug: true,
            duration: true,
            coverPhoto: true,
          },
        },
        winery: {
          select: {
            name: true,
            slug: true,
            address: true,
            commune: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Booking not found or invalid token',
        },
      };
    }

    return {
      success: true,
      data: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        visitorName: booking.visitorName,
        visitorEmail: booking.visitorEmail,
        visitorPhone: booking.visitorPhone,
        date: booking.date,
        timeSlot: booking.timeSlot,
        guestCount: booking.guestCount,
        totalPrice: booking.totalPrice,
        serviceFeeCents: booking.serviceFeeCents,
        experience: booking.experience,
        winery: booking.winery,
      },
    };
  } catch (error) {
    logError('getBookingByToken error', error, { action: 'getBookingByToken' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get booking' },
    };
  }
}

export interface CancellationResult {
  bookingId: string;
  status: BookingStatus;
  refundIssued: boolean;
  refundAmount: number | null;
}

/**
 * Cancel a booking and process refund if eligible
 * Refund follows the winery's cancellation policy (P-03 / L-043).
 */
export async function cancelBooking(
  bookingId: string,
  accessToken: string
): Promise<ActionResult<CancellationResult>> {
  try {
    // Hash the token to compare with stored hash (SEC-002: plaintext token no longer stored)
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    // Find booking and verify access
    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        accessTokenHash: tokenHash,
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
        error: {
          code: 'NOT_FOUND',
          message: 'Booking not found or invalid access',
        },
      };
    }

    // Check if booking can be cancelled
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

    // Check if experience hasn't already passed
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
    // current policy for legacy rows) on the full paid amount (D2),
    // minus anything already refunded (e.g. an admin partial refund).
    const { policy, paidCents, alreadyRefundedCents, refundDueCents } =
      computeBookingRefund(booking, hoursUntilExperience);
    let refundAmount: number | null = null;
    let stripeRefundId: string | null = null;
    let giftRestoredCents = 0;
    let totalReturnedCents = 0;

    // Atomic claim: the status flip IS the lock. Two concurrent
    // cancellations would otherwise both pass the CONFIRMED check and
    // both obtain a 50% partial refund (100% total, taken twice from
    // the winery). Only the request that wins this update refunds.
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

    // Process the refund — gift-aware since P-16 (ADR-0003): card refund
    // first, gift-balance restoration, winery transfer reversal. Classic
    // bookings keep the single destination-charge refund.
    if (refundDueCents > 0) {
      try {
        const outcome = await processCancellationRefund({
          bookingId,
          stripePaymentIntentId: booking.stripePaymentIntentId,
          giftAppliedCents: booking.giftAppliedCents,
          wineryPayout: booking.wineryPayout,
          refundDueCents,
          alreadyRefundedCents,
          paidCents,
          // Same rounding rule as the client refund (computeRefundCents),
          // applied to the winery payout for the clawback share.
          reversalCents: computeRefundCents(
            policy,
            hoursUntilExperience,
            booking.wineryPayout
          ),
          actionName: 'cancelBooking',
        });
        refundAmount = outcome.cardRefundCents;
        stripeRefundId = outcome.stripeRefundId;
        giftRestoredCents = outcome.giftRestoredCents;
        totalReturnedCents = outcome.totalReturnedCents;
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
          // Appended, and with the pending GIFT movements named (review
          // #120 sweep): the card refund is the FIRST movement — an
          // ambiguous failure means the gift restore and the winery
          // reversal never ran, and no cron retries a cancelled booking.
          await appendRefundError(
            bookingId,
            booking.giftAppliedCents > 0
              ? `CARD_REFUND_AMBIGUOUS on gift booking (gift restore + winery reversal NOT run — reconcile all three movements, runbook incident-paiement): ${String(refundError)}`
              : String(refundError)
          );
        }
        logError('Refund processing error', refundError, {
          action: 'cancelBooking',
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

    // Record the refund outcome on the already-cancelled booking.
    // refundAmount persists the TOTAL value returned — card refund AND
    // restored gift balance (ADR-0003, Codex review): reloaded client/admin
    // views and the admin remaining-refund cap read this field, and the
    // earnings refundedFraction must reflect the full clawback. The pure
    // Stripe fact stays traceable via stripeRefundId + the gift ledger.
    // Conditional on the refundAmount we READ: a concurrent admin refund
    // that landed in between must not be clobbered out of the ledger —
    // on conflict we keep the DB value and flag for reconciliation.
    if (totalReturnedCents > 0) {
      const recorded = await db.booking.updateMany({
        where: { id: bookingId, refundAmount: booking.refundAmount },
        data: {
          refundIssued: true,
          refundAmount: alreadyRefundedCents + totalReturnedCents,
          // A gift-only restitution has no Stripe refund — never null out
          // a re_ written by an earlier admin refund (review #120).
          ...(stripeRefundId ? { stripeRefundId } : {}),
        },
      });
      if (recorded.count === 0) {
        logWarn('Refund ledger conflict — concurrent refund writer', {
          action: 'cancelBooking',
          bookingId,
          cancelRefundCents: totalReturnedCents,
          stripeRefundId,
        });
        await appendRefundError(
          bookingId,
          `LEDGER_CONFLICT: cancellation returned ${totalReturnedCents} (${stripeRefundId ?? 'gift only'}) concurrently with another refund writer — reconcile with Stripe`
        );
      }
    }
    const updatedBooking = await db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { id: true, status: true },
    });

    // Combine date and timeSlot for email formatting
    const bookingDateTime = new Date(booking.date);
    bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

    // Send cancellation email to client. Price row shows the full paid
    // amount; refund line shows the exact processed amount — or the
    // generic wording when a refund was due but no payment intent was on
    // file (never affirm "no refund" to a client the policy entitles).
    // A gift-funded booking counts the restored balance as returned value
    // (ADR-0003) — a card=0 cancellation is fully processed, not missing.
    const refundUnprocessable =
      refundDueCents > 0 && refundAmount === null && giftRestoredCents === 0;
    if (refundUnprocessable) {
      logError(
        'Refund due but no Stripe payment intent on booking',
        undefined,
        { action: 'cancelBooking', bookingId, refundDueCents }
      );
    }
    await sendBookingCancellationEmail(booking.visitorEmail, {
      guestName: booking.visitorName,
      experienceTitle: booking.experience.title,
      wineryName: booking.winery.name,
      date: bookingDateTime,
      totalPrice: paidCents,
      refundAmountCents: refundUnprocessable ? null : totalReturnedCents,
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

    return {
      success: true,
      data: {
        bookingId: updatedBooking.id,
        status: updatedBooking.status,
        // Client-facing: card refund + restored gift balance (ADR-0003).
        refundIssued: totalReturnedCents > 0,
        refundAmount: totalReturnedCents > 0 ? totalReturnedCents : null,
      },
    };
  } catch (error) {
    logError('cancelBooking error', error, {
      action: 'cancelBooking',
      bookingId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel booking' },
    };
  }
}

/**
 * Get cancellation eligibility info for a booking
 */
export async function getCancellationInfo(
  bookingId: string,
  accessToken: string
): Promise<
  ActionResult<{
    canCancel: boolean;
    isEligibleForRefund: boolean;
    hoursUntilExperience: number;
    refundAmount: number;
    reason?: string;
  }>
> {
  try {
    // Hash the token to compare with stored hash (SEC-002: plaintext token no longer stored)
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        accessTokenHash: tokenHash,
      },
      include: {
        winery: { select: { cancellationPolicy: true } },
      },
    });

    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    // Check status
    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        success: true,
        data: {
          canCancel: false,
          isEligibleForRefund: false,
          hoursUntilExperience: 0,
          refundAmount: 0,
          reason: 'Only confirmed bookings can be cancelled',
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

    // Check if experience hasn't passed
    if (hoursUntilExperience < 0) {
      return {
        success: true,
        data: {
          canCancel: false,
          isEligibleForRefund: false,
          hoursUntilExperience: 0,
          refundAmount: 0,
          reason: 'Cannot cancel a past booking',
        },
      };
    }

    // Policy-based amount on the full paid total (tickets + service fee).
    const refundAmount = computeBookingRefund(
      booking,
      hoursUntilExperience
    ).refundDueCents;

    return {
      success: true,
      data: {
        canCancel: true,
        isEligibleForRefund: refundAmount > 0,
        hoursUntilExperience,
        refundAmount,
      },
    };
  } catch (error) {
    logError('getCancellationInfo error', error, {
      action: 'getCancellationInfo',
      bookingId,
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get cancellation info',
      },
    };
  }
}
