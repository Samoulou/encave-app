'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  createConnectAccount,
  getStripeLoginLink,
  syncStripeAccountStatus,
  canPublishExperiences,
} from '@/server/services/payment.service';
import { env } from '@/lib/env';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';

/**
 * Starts the Stripe Connect onboarding flow for a winemaker
 */
export async function startStripeOnboarding(
  wineryId: string
): Promise<ActionResult<{ url: string }>> {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // 2. Verify Stripe is configured
    if (!env.STRIPE_SECRET_KEY) {
      return {
        success: false,
        error: {
          code: 'STRIPE_NOT_CONFIGURED',
          message: 'Payment system is not configured',
        },
      };
    }

    // 3. Verify winery ownership
    const winery = await db.winery.findUnique({
      where: { id: wineryId },
      select: { userId: true, status: true },
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
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      };
    }

    // 4. Verify winery is verified
    if (winery.status !== 'VERIFIED') {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Winery must be verified before setting up payments',
        },
      };
    }

    // 5. Create or get onboarding link
    const onboardingUrl = await createConnectAccount(wineryId);

    return { success: true, data: { url: onboardingUrl } };
  } catch (error) {
    logError('startStripeOnboarding error', error, {
      action: 'startStripeOnboarding',
      wineryId,
    });
    return {
      success: false,
      error: {
        code: 'STRIPE_ERROR',
        message: 'Failed to start payment setup. Please try again.',
      },
    };
  }
}

/**
 * Handles the callback from Stripe onboarding
 */
export async function handleStripeCallback(): Promise<
  ActionResult<{ status: 'complete' | 'incomplete' | 'refresh' }>
> {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // 2. Get winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { stripeAccountId: true },
    });

    if (!winery?.stripeAccountId) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Stripe account not found' },
      };
    }

    // 3. Sync status from Stripe
    await syncStripeAccountStatus(winery.stripeAccountId);

    // 4. Check updated status
    const updatedWinery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { stripeOnboardingComplete: true, stripeDetailsSubmitted: true },
    });

    if (updatedWinery?.stripeOnboardingComplete) {
      return { success: true, data: { status: 'complete' } };
    }

    if (updatedWinery?.stripeDetailsSubmitted) {
      return { success: true, data: { status: 'incomplete' } };
    }

    return { success: true, data: { status: 'refresh' } };
  } catch (error) {
    logError('handleStripeCallback error', error, {
      action: 'handleStripeCallback',
    });
    return {
      success: false,
      error: {
        code: 'STRIPE_ERROR',
        message: 'Failed to verify payment setup',
      },
    };
  }
}

/**
 * Gets the Stripe Express dashboard login link
 */
export async function getStripeDashboardLink(): Promise<
  ActionResult<{ url: string }>
> {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // 2. Get winery
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { stripeAccountId: true },
    });

    if (!winery?.stripeAccountId) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Stripe account not connected' },
      };
    }

    // 3. Get login link
    const url = await getStripeLoginLink(winery.stripeAccountId);

    return { success: true, data: { url } };
  } catch (error) {
    logError('getStripeDashboardLink error', error, {
      action: 'getStripeDashboardLink',
    });
    return {
      success: false,
      error: {
        code: 'STRIPE_ERROR',
        message: 'Failed to access payment dashboard',
      },
    };
  }
}

/**
 * Checks if the winery can publish experiences
 */
export async function checkCanPublish(
  wineryId: string
): Promise<ActionResult<{ canPublish: boolean; reason?: string }>> {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    // 2. Verify ownership
    const winery = await db.winery.findUnique({
      where: { id: wineryId },
      select: { userId: true },
    });

    if (!winery || winery.userId !== session.user.id) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      };
    }

    // 3. Check publishing eligibility
    const result = await canPublishExperiences(wineryId);

    return { success: true, data: result };
  } catch (error) {
    logError('checkCanPublish error', error, {
      action: 'checkCanPublish',
      wineryId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to check status' },
    };
  }
}
