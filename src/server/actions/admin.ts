'use server';

import { z } from 'zod';
import { BookingStatus, WineryPlan, WineryStatus } from '@prisma/client';
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
import { logError, logInfo, logWarn } from '@/lib/logger';
import { invalidateWineryCaches } from './winery-helpers';
import { requireAdmin } from '@/server/admin-guard';

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

const SuspensionSchema = z.object({
  targetId: z.string().cuid(),
  reason: z.string().trim().min(10).max(500),
});

const SetWineryPlanSchema = z.object({
  wineryId: z.string().min(1, 'Winery ID is required'),
  plan: z.nativeEnum(WineryPlan),
  // UI percentage (0–100); null = platform default (PLATFORM_COMMISSION_RATE)
  commissionRatePercent: z.number().min(0).max(100).nullable(),
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
  // Refundable base = everything the client paid (tickets + service fee).
  const paidCents = booking.totalPrice + booking.serviceFeeCents;
  const remaining = paidCents - alreadyRefunded;
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

  // Reserve the amount ATOMICALLY before Stripe (résidu Luca B, P-03).
  // Two concurrent refunds (admin double-click, admin + client
  // cancellation) would both read the same `refundAmount` and both pass
  // the cap check within the charge limit. The conditional update lets
  // exactly one caller through; the loser sees count 0 and backs off.
  const nextRefunded = alreadyRefunded + amountCents;
  const reserved = await db.booking.updateMany({
    where: {
      id: booking.id,
      refundAmount: booking.refundAmount,
      stripeRefundId: booking.stripeRefundId,
    },
    data: { refundAmount: nextRefunded },
  });
  if (reserved.count === 0) {
    return {
      success: false,
      error: {
        code: 'CONFLICT',
        message:
          'Another refund is already in progress for this booking. Reload and check the refunded amount before retrying.',
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

    const isFullRefund = nextRefunded >= paidCents;
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
    // Release the reservation ONLY on a deterministic Stripe rejection —
    // after an ambiguous network error the refund may have succeeded, and
    // releasing would allow a second one once the idempotency key expires
    // (24h). Ambiguous → keep the reserved amount + refundError for
    // manual reconciliation (same doctrine as cancelBooking).
    const deterministic =
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'StripeInvalidRequestError';
    if (deterministic) {
      await db.booking.updateMany({
        where: { id: booking.id, refundAmount: nextRefunded },
        data: { refundAmount: booking.refundAmount },
      });
    } else {
      await db.booking.update({
        where: { id: booking.id },
        data: { refundError: String(error) },
      });
    }
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

/**
 * Set a winery's pricing plan and per-winery commission rate (P-03 / L-042).
 * The rate arrives as a UI percentage (0–100) and is stored as a fraction
 * (0–1); null falls back to the platform default (PLATFORM_COMMISSION_RATE),
 * resolved by `getEffectiveCommissionRate` at checkout time.
 */
export async function setWineryPlan(
  wineryId: string,
  plan: WineryPlan,
  commissionRatePercent: number | null
): Promise<ActionResult<{ plan: WineryPlan; commissionRate: number | null }>> {
  try {
    const admin = await requireAdmin();
    if (!admin.success) return admin;

    const validated = SetWineryPlanSchema.safeParse({
      wineryId,
      plan,
      commissionRatePercent,
    });
    if (!validated.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid plan or commission rate',
        },
      };
    }

    const winery = await db.winery.findUnique({
      where: { id: validated.data.wineryId },
      select: { id: true, slug: true },
    });
    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    const commissionRate =
      validated.data.commissionRatePercent === null
        ? null
        : validated.data.commissionRatePercent / 100;

    const [updated] = await db.$transaction([
      db.winery.update({
        where: { id: winery.id },
        data: { plan: validated.data.plan, commissionRate },
      }),
      // Same audit trail as suspensions/refunds (money-touching change).
      db.adminAction.create({
        data: {
          adminId: admin.data.adminId,
          action: 'WINERY_PLAN_UPDATED',
          targetType: 'Winery',
          targetId: winery.id,
          metadata: { plan: validated.data.plan, commissionRate },
        },
      }),
    ]);

    // Money-touching admin change: always logged (P-03 audit trail).
    logInfo('winery-plan.updated', {
      action: 'setWineryPlan',
      wineryId: winery.id,
      plan: updated.plan,
      commissionRate: updated.commissionRate,
      adminId: admin.data.adminId,
    });

    invalidateWineryCaches(winery.slug);

    return {
      success: true,
      data: { plan: updated.plan, commissionRate: updated.commissionRate },
    };
  } catch (error) {
    logError('setWineryPlan error', error, {
      action: 'setWineryPlan',
      wineryId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}

export async function suspendWinery(
  input: unknown
): Promise<ActionResult<{ status: WineryStatus }>> {
  const parsed = SuspensionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid suspension' },
    };
  }

  const admin = await requireAdmin();
  if (!admin.success) return admin;

  const winery = await db.winery.findUnique({
    where: { id: parsed.data.targetId },
    select: { id: true, slug: true, status: true },
  });
  if (!winery) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Winery not found' },
    };
  }

  await db.$transaction([
    db.winery.update({
      where: { id: winery.id },
      data: { status: WineryStatus.SUSPENDED },
    }),
    db.experience.updateMany({
      where: { wineryId: winery.id, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    }),
    db.adminAction.create({
      data: {
        adminId: admin.data.adminId,
        action: 'SUSPEND_WINERY',
        targetType: 'Winery',
        targetId: winery.id,
        reason: parsed.data.reason,
        metadata: { previousStatus: winery.status },
      },
    }),
  ]);

  invalidateWineryCaches(winery.slug);
  return { success: true, data: { status: WineryStatus.SUSPENDED } };
}

export async function reinstateWinery(
  input: unknown
): Promise<ActionResult<{ status: WineryStatus }>> {
  const parsed = SuspensionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid reinstatement' },
    };
  }

  const admin = await requireAdmin();
  if (!admin.success) return admin;

  const winery = await db.winery.findUnique({
    where: { id: parsed.data.targetId },
    select: { id: true, slug: true, status: true },
  });
  if (!winery) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Winery not found' },
    };
  }

  await db.$transaction([
    db.winery.update({
      where: { id: winery.id },
      data: { status: WineryStatus.VERIFIED },
    }),
    db.adminAction.create({
      data: {
        adminId: admin.data.adminId,
        action: 'REINSTATE_WINERY',
        targetType: 'Winery',
        targetId: winery.id,
        reason: parsed.data.reason,
        metadata: { previousStatus: winery.status },
      },
    }),
  ]);

  invalidateWineryCaches(winery.slug);
  return { success: true, data: { status: WineryStatus.VERIFIED } };
}

export async function suspendUser(
  input: unknown
): Promise<ActionResult<{ suspendedAt: Date }>> {
  const parsed = SuspensionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid suspension' },
    };
  }

  const admin = await requireAdmin();
  if (!admin.success) return admin;
  if (parsed.data.targetId === admin.data.adminId) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Cannot suspend yourself' },
    };
  }

  const now = new Date();
  await db.$transaction([
    db.user.update({
      where: { id: parsed.data.targetId },
      data: {
        suspendedAt: now,
        suspendedBy: admin.data.adminId,
        suspensionReason: parsed.data.reason,
      },
    }),
    db.adminAction.create({
      data: {
        adminId: admin.data.adminId,
        action: 'SUSPEND_USER',
        targetType: 'User',
        targetId: parsed.data.targetId,
        reason: parsed.data.reason,
      },
    }),
  ]);

  return { success: true, data: { suspendedAt: now } };
}

export async function reinstateUser(
  input: unknown
): Promise<ActionResult<{ reinstated: boolean }>> {
  const parsed = SuspensionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid reinstatement' },
    };
  }

  const admin = await requireAdmin();
  if (!admin.success) return admin;

  await db.$transaction([
    db.user.update({
      where: { id: parsed.data.targetId },
      data: {
        suspendedAt: null,
        suspendedBy: null,
        suspensionReason: null,
      },
    }),
    db.adminAction.create({
      data: {
        adminId: admin.data.adminId,
        action: 'REINSTATE_USER',
        targetType: 'User',
        targetId: parsed.data.targetId,
        reason: parsed.data.reason,
      },
    }),
  ]);

  return { success: true, data: { reinstated: true } };
}
