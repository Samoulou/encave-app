'use server';

import type { CancellationPolicy } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { setWineryCancellationPolicySchema } from '@/lib/validators/winery';
import { logError, logInfo } from '@/lib/logger';
import type { ActionResult } from '@/types/actions';
import { invalidateWineryCaches } from './winery-helpers';

/**
 * Winery cancellation-policy selection (P-03 / L-043).
 *
 * The winery owner picks one of the three policies (FLEXIBLE / STANDARD /
 * STRICT — barèmes in src/lib/business-rules/cancellation-policy.ts). The
 * policy applies to future cancellations of the winery's bookings, so the
 * change is audit-logged and the public caches (experience pages, checkout
 * summary) are invalidated.
 */
export async function setWineryCancellationPolicy(
  input: unknown
): Promise<ActionResult<{ policy: CancellationPolicy }>> {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // 2. Validate input
    const validated = setWineryCancellationPolicySchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstError?.message ?? 'Invalid input',
        },
      };
    }

    const { wineryId, policy } = validated.data;

    // 3. Authorization — only the winery owner may change its policy
    const winery = await db.winery.findUnique({
      where: { id: wineryId },
      select: { id: true, slug: true, userId: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    if (winery.userId !== session.user.id) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own winery',
        },
      };
    }

    // 4. Update
    const updated = await db.winery.update({
      where: { id: winery.id },
      data: { cancellationPolicy: policy },
      select: { cancellationPolicy: true },
    });

    // Refund-impacting setting: mandatory audit log.
    logInfo('winery-policy.updated', {
      wineryId: winery.id,
      policy: updated.cancellationPolicy,
      userId: session.user.id,
    });

    // 5. The policy is displayed on the public experience pages and at
    // checkout — refresh the winery-related caches.
    invalidateWineryCaches(winery.slug);

    return {
      success: true,
      data: { policy: updated.cancellationPolicy },
    };
  } catch (error) {
    logError('setWineryCancellationPolicy error', error, {
      action: 'setWineryCancellationPolicy',
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
