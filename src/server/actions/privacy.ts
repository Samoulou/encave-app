'use server';

import { z } from 'zod';
import { auth } from '@/server/auth';
import { anonymizeUser } from '@/server/services/anonymization.service';
import { logError } from '@/lib/logger';
import type { ActionResult } from '@/types/actions';

const DeleteAccountSchema = z.object({
  email: z.string().email(),
});

export async function requestAccountDeletion(
  input: unknown
): Promise<ActionResult<{ alreadyAnonymized: boolean }>> {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    };
  }
  // Account deletion anonymizes guest bookings matched by email — require a
  // VERIFIED email so an unverified sign-up can't destroy another guest's data.
  if (!session.user.emailVerified) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'EMAIL_NOT_VERIFIED' },
    };
  }

  const parsed = DeleteAccountSchema.safeParse(input);
  if (!parsed.success || parsed.data.email !== session.user.email) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid confirmation' },
    };
  }

  try {
    const result = await anonymizeUser(session.user.id);
    return { success: true, data: result };
  } catch (error) {
    logError('Account deletion failed', error, {
      action: 'requestAccountDeletion',
      userId: session.user.id,
    });
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message:
          error instanceof Error ? error.message : 'Account deletion failed',
      },
    };
  }
}
