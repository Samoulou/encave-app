'use server';

import { z } from 'zod';
import { BookingStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  sendManualRefundClientEmail,
  sendManualRefundWinemakerEmail,
  sendWineryApprovedEmail,
  sendWineryRejectedEmail,
} from '@/server/services/email.service';
import { getStripe } from '@/server/stripe';
import type { ActionResult } from '@/types/actions';
import { logError, logWarn } from '@/lib/logger';
import { invalidateWineryCaches } from './winery-helpers';

const ApproveWinerySchema = z.object({
  wineryId: z.string().min(1, 'Winery ID is required'),
});

const RejectWinerySchema = z.object({
  wineryId: z.string().min(1, 'Winery ID is required'),
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
});

const ManualRefundSchema = z.object({
  bookingId: z.string().cuid(),
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(10).max(500),
});

/**
 * Approve a winery registration
 */
export async function approveWinery(
  wineryId: string
): Promise<ActionResult<{ verifiedAt: Date }>> {
  try {
    // Validate input
    const validated = ApproveWinerySchema.safeParse({ wineryId });
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid winery ID' },
      };
    }

    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in' },
      };
    }

    if (session.user.role !== 'ADMIN') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      };
    }

    const winery = await db.winery.findUnique({
      where: { id: wineryId },
      include: {
        user: { select: { email: true, name: true, preferredLocale: true } },
      },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    if (winery.status !== 'PENDING') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Cannot approve winery with status: ${winery.status}`,
        },
      };
    }

    const now = new Date();

    // Update winery and create verification log in transaction
    await db.$transaction([
      db.winery.update({
        where: { id: wineryId },
        data: {
          status: 'VERIFIED',
          verifiedAt: now,
          verifiedBy: session.user.id,
        },
      }),
      db.verificationLog.create({
        data: {
          wineryId,
          action: 'APPROVED',
          adminId: session.user.id,
        },
      }),
    ]);

    // Status flip to VERIFIED can immediately make the winery publicly
    // visible (if all other ENC-027 criteria already match).
    invalidateWineryCaches(winery.slug);

    // Send approval email (log failure but don't fail the action)
    const emailSent = await sendWineryApprovedEmail(
      winery.user.email,
      winery.user.name ?? 'Winemaker',
      winery.name,
      winery.user.preferredLocale
    );
    if (!emailSent) {
      logWarn('Failed to send approval email', {
        action: 'approveWinery',
        wineryId,
        email: winery.user.email,
      });
    }

    return {
      success: true,
      data: { verifiedAt: now },
    };
  } catch (error) {
    logError('approveWinery error', error, {
      action: 'approveWinery',
      wineryId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}

/**
 * Reject a winery registration
 */
export async function rejectWinery(
  wineryId: string,
  reason: string
): Promise<ActionResult<{ rejectedAt: Date }>> {
  try {
    // Validate input
    const validated = RejectWinerySchema.safeParse({
      wineryId,
      reason: reason.trim(),
    });
    if (!validated.success) {
      const firstIssue = validated.error.issues[0];
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstIssue?.message || 'Invalid input',
        },
      };
    }

    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in' },
      };
    }

    if (session.user.role !== 'ADMIN') {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      };
    }

    const winery = await db.winery.findUnique({
      where: { id: wineryId },
      include: {
        user: { select: { email: true, name: true, preferredLocale: true } },
      },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    if (winery.status !== 'PENDING') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Cannot reject winery with status: ${winery.status}`,
        },
      };
    }

    const now = new Date();
    const trimmedReason = validated.data.reason;

    // Update winery and create verification log in transaction
    await db.$transaction([
      db.winery.update({
        where: { id: wineryId },
        data: {
          status: 'REJECTED',
          rejectionReason: trimmedReason,
        },
      }),
      db.verificationLog.create({
        data: {
          wineryId,
          action: 'REJECTED',
          adminId: session.user.id,
          reason: trimmedReason,
        },
      }),
    ]);

    // Defensive: a REJECTED winery should never have been visible, but
    // invalidate caches anyway so any stale entry is purged.
    invalidateWineryCaches(winery.slug);

    // Send rejection email (log failure but don't fail the action)
    const emailSent = await sendWineryRejectedEmail(
      winery.user.email,
      winery.user.name ?? 'Winemaker',
      winery.name,
      trimmedReason,
      winery.user.preferredLocale
    );
    if (!emailSent) {
      logWarn('Failed to send rejection email', {
        action: 'rejectWinery',
        wineryId,
        email: winery.user.email,
      });
    }

    return {
      success: true,
      data: { rejectedAt: now },
    };
  } catch (error) {
    logError('rejectWinery error', error, { action: 'rejectWinery', wineryId });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}

export async function refundBookingManually(
  input: unknown
): Promise<ActionResult<{ refundId: string; refundedAmount: number }>> {
  const parsed = ManualRefundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid refund request' },
    };
  }

  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please sign in' },
    };
  }
  if (session.user.role !== 'ADMIN') {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    };
  }

  const { bookingId, amountCents, reason } = parsed.data;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      experience: {
        select: {
          title: true,
        },
      },
      winery: {
        select: {
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
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Booking not found' },
    };
  }

  const alreadyRefunded = booking.refundAmount ?? 0;
  const remaining = booking.totalPrice - alreadyRefunded;
  if (remaining <= 0 || amountCents > remaining) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid refund amount' },
    };
  }

  if (!booking.stripePaymentIntentId?.startsWith('pi_')) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'No captured Stripe payment intent on this booking',
      },
    };
  }

  try {
    const refund = await getStripe().refunds.create(
      {
        payment_intent: booking.stripePaymentIntentId,
        amount: amountCents,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: {
          bookingId: booking.id,
          bookingReference: booking.reference,
          adminId: session.user.id,
          reason,
        },
      },
      {
        idempotencyKey: `admin-refund:${booking.id}:${alreadyRefunded}:${amountCents}`,
      }
    );

    const nextRefunded = alreadyRefunded + amountCents;
    const isFullRefund = nextRefunded >= booking.totalPrice;
    await db.$transaction([
      db.booking.update({
        where: { id: booking.id },
        data: {
          refundIssued: isFullRefund,
          refundAmount: nextRefunded,
          stripeRefundId: refund.id,
          refundError: null,
          ...(isFullRefund &&
          (booking.status === BookingStatus.CONFIRMED ||
            booking.status === BookingStatus.PENDING_PAYMENT)
            ? {
                status: BookingStatus.CANCELLED_BY_WINERY,
                cancelledAt: new Date(),
                cancellationReason: 'ADMIN_REFUND',
              }
            : {}),
        },
      }),
      db.adminAction.create({
        data: {
          adminId: session.user.id,
          action: 'REFUND_BOOKING',
          targetType: 'Booking',
          targetId: booking.id,
          reason,
          metadata: {
            refundId: refund.id,
            amountCents,
            type: isFullRefund ? 'FULL' : 'PARTIAL',
          },
        },
      }),
    ]);

    await sendManualRefundClientEmail(booking.visitorEmail, {
      firstName: booking.visitorName.split(' ')[0] ?? booking.visitorName,
      reference: booking.reference,
      experienceTitle: booking.experience.title,
      amountCents,
    });
    await sendManualRefundWinemakerEmail(
      booking.winery.email,
      {
        firstName: booking.winery.user.name ?? 'Bonjour',
        reference: booking.reference,
        experienceTitle: booking.experience.title,
        date: booking.date,
        amountCents,
        reason,
      },
      booking.winery.user.preferredLocale
    );

    return {
      success: true,
      data: { refundId: refund.id, refundedAmount: nextRefunded },
    };
  } catch (error) {
    await db.adminAction.create({
      data: {
        adminId: session.user.id,
        action: 'REFUND_BOOKING',
        targetType: 'Booking',
        targetId: booking.id,
        status: 'FAILED',
        reason,
        metadata: {
          amountCents,
          error: String(error),
        },
      },
    });
    await db.booking.update({
      where: { id: booking.id },
      data: { refundError: String(error) },
    });
    logError('Manual refund failed', error, {
      action: 'refundBookingManually',
      bookingId: booking.id,
    });
    return {
      success: false,
      error: { code: 'STRIPE_ERROR', message: 'Stripe refund failed' },
    };
  }
}
