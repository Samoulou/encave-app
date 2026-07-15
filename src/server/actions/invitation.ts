'use server';

import crypto from 'crypto';
import { addDays } from 'date-fns';
import { auth } from '@/server/auth';
import { requireAdmin } from '@/server/admin-guard';
import { db } from '@/server/db';
import { hashToken } from '@/lib/utils/token';
import { generateSlug, ensureUniqueSlug } from '@/lib/utils/slug';
import { getBaseUrl } from '@/lib/env';
import {
  createFounderInvitationSchema,
  provisionFounderWinerySchema,
  type CreateFounderInvitationInput,
  type ProvisionFounderWineryInput,
} from '@/lib/validators/invitation';
import { logError } from '@/lib/logger';
import type { ActionResult } from '@/types/actions';
import { invalidateWineryCaches } from './winery-helpers';

const INVITATION_TTL_DAYS = 7;

/**
 * Admin issues a founder-invitation link. The plaintext token is returned
 * ONCE (only its sha256 hash is stored, SEC-002); the admin sends the link.
 */
export async function createFounderInvitation(
  input: CreateFounderInvitationInput
): Promise<ActionResult<{ url: string; expiresAt: Date }>> {
  try {
    const admin = await requireAdmin();
    if (!admin.success) return admin;

    const parsed = createFounderInvitationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = addDays(new Date(), INVITATION_TTL_DAYS);

    await db.invitation.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        tokenHash: hashToken(token),
        wineryName: parsed.data.wineryName,
        invitedBy: admin.data.adminId,
        expiresAt,
      },
    });

    return {
      success: true,
      data: { url: `${getBaseUrl()}/invitation/${token}`, expiresAt },
    };
  } catch (error) {
    logError('createFounderInvitation error', error, {
      action: 'createFounderInvitation',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}

/**
 * Provision the caller's winery as VERIFIED + FOUNDER (0% commission),
 * skipping the approval queue. Called right after the invitee signs up. The
 * winery is created with minimal details — it stays non-public (visibility
 * gate) until the founder completes their profile + Stripe + first experience.
 */
export async function provisionFounderWinery(
  input: ProvisionFounderWineryInput
): Promise<ActionResult<{ wineryId: string; slug: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    const parsed = provisionFounderWinerySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      };
    }

    const invitation = await db.invitation.findUnique({
      where: { tokenHash: hashToken(parsed.data.token) },
      select: { id: true, acceptedAt: true, expiresAt: true, invitedBy: true },
    });

    if (!invitation) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation not found' },
      };
    }
    if (invitation.acceptedAt) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'Invitation already used' },
      };
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'Invitation expired' },
      };
    }

    // One winery per user.
    const existing = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (existing) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'You already have a winery' },
      };
    }

    const slug = await ensureUniqueSlug(
      generateSlug(parsed.data.wineryName),
      async (candidate) =>
        !!(await db.winery.findUnique({
          where: { slug: candidate },
          select: { id: true },
        }))
    );

    const winery = await db.$transaction(async (tx) => {
      const created = await tx.winery.create({
        data: {
          name: parsed.data.wineryName,
          slug,
          description: '',
          address: '',
          commune: '',
          phone: '',
          email: session.user.email,
          userId: session.user.id,
          status: 'VERIFIED',
          plan: 'FOUNDER',
          commissionRate: 0,
          verifiedAt: new Date(),
          verifiedBy: invitation.invitedBy,
        },
      });

      await tx.user.update({
        where: { id: session.user.id },
        data: { role: 'WINEMAKER' },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), acceptedUserId: session.user.id },
      });

      await tx.verificationLog.create({
        data: {
          wineryId: created.id,
          action: 'APPROVED',
          adminId: invitation.invitedBy,
          reason: 'Founder invitation',
        },
      });

      return created;
    });

    invalidateWineryCaches();

    return {
      success: true,
      data: { wineryId: winery.id, slug: winery.slug },
    };
  } catch (error) {
    logError('provisionFounderWinery error', error, {
      action: 'provisionFounderWinery',
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    };
  }
}
