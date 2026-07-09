'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { FLAG_KEYS, type FlagKey } from '@/lib/flags';
import { FEATURE_FLAGS_CACHE_TAG } from '@/server/queries/feature-flags.queries';
import { logError, logInfo } from '@/lib/logger';
import type { ActionResult } from '@/types/actions';

const SetFeatureFlagSchema = z.object({
  key: z.enum(FLAG_KEYS as [FlagKey, ...FlagKey[]]),
  enabled: z.boolean(),
});

/**
 * Admin kill-switch (P-03). Toggling revalidates the flag cache tag, so
 * the change is effective on the next request — no deploy, < 1 min.
 * Every toggle is logged (money features audit trail).
 */
export async function setFeatureFlag(
  key: string,
  enabled: boolean
): Promise<ActionResult<{ key: FlagKey; enabled: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in' },
      };
    }
    if (session.user.role !== UserRole.ADMIN) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      };
    }

    const validated = SetFeatureFlagSchema.safeParse({ key, enabled });
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Unknown feature flag' },
      };
    }

    const flag = await db.featureFlag.upsert({
      where: { key: validated.data.key },
      update: { enabled: validated.data.enabled },
      create: { key: validated.data.key, enabled: validated.data.enabled },
    });

    revalidateTag(FEATURE_FLAGS_CACHE_TAG);

    logInfo('feature-flag.toggled', {
      key: flag.key,
      enabled: flag.enabled,
      adminId: session.user.id,
    });

    return {
      success: true,
      data: { key: validated.data.key, enabled: flag.enabled },
    };
  } catch (error) {
    logError('setFeatureFlag error', error, { action: 'setFeatureFlag', key });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update flag' },
    };
  }
}
