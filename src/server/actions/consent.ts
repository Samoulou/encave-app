'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { consentSchema } from '@/lib/validators/consent';
import { logError } from '@/lib/logger';
import type { ActionResult } from '@/types/actions';

export async function updateConsent(
  input: unknown
): Promise<ActionResult<null>> {
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid consent payload' },
    };
  }

  const session = await auth();
  if (!session?.user) {
    return { success: true, data: null };
  }

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { cookieConsent: parsed.data },
    });
    return { success: true, data: null };
  } catch (error) {
    logError('Failed to persist consent', error, {
      action: 'updateConsent',
      userId: session.user.id,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to save consent' },
    };
  }
}
