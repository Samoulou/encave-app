'use server';

import { z } from 'zod';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  sendWineryApprovedEmail,
  sendWineryRejectedEmail,
} from '@/server/services/email.service';
import type { ActionResult } from '@/types/actions';

const ApproveWinerySchema = z.object({
  wineryId: z.string().min(1, 'Winery ID is required'),
});

const RejectWinerySchema = z.object({
  wineryId: z.string().min(1, 'Winery ID is required'),
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
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
        user: { select: { email: true } },
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

    // Send approval email (log failure but don't fail the action)
    const emailSent = await sendWineryApprovedEmail(winery.user.email, winery.name);
    if (!emailSent) {
      console.warn(`[approveWinery] Failed to send approval email to ${winery.user.email} for winery ${wineryId}`);
    }

    return {
      success: true,
      data: { verifiedAt: now },
    };
  } catch (error) {
    console.error('approveWinery error:', error);
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
    const validated = RejectWinerySchema.safeParse({ wineryId, reason: reason.trim() });
    if (!validated.success) {
      const firstIssue = validated.error.issues[0];
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstIssue?.message || 'Invalid input'
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
        user: { select: { email: true } },
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

    // Send rejection email (log failure but don't fail the action)
    const emailSent = await sendWineryRejectedEmail(winery.user.email, winery.name, trimmedReason);
    if (!emailSent) {
      console.warn(`[rejectWinery] Failed to send rejection email to ${winery.user.email} for winery ${wineryId}`);
    }

    return {
      success: true,
      data: { rejectedAt: now },
    };
  } catch (error) {
    console.error('rejectWinery error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };
  }
}
