'use server';

import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { auth } from '@/server/auth';
import { anonymizeUser } from '@/server/services/anonymization.service';
import { logError } from '@/lib/logger';
import type { ActionResult } from '@/types/actions';

const DeleteAccountSchema = z.object({
  email: z.string().email(),
});

const AdminAnonymizeSchema = z.object({
  userId: z.string().cuid(),
  reason: z.string().trim().min(10).max(500),
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

export async function adminAnonymizeUser(
  input: unknown
): Promise<ActionResult<{ alreadyAnonymized: boolean }>> {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    };
  }
  if (session.user.role !== UserRole.ADMIN) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    };
  }

  const parsed = AdminAnonymizeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid anonymization' },
    };
  }

  try {
    const result = await anonymizeUser(parsed.data.userId, {
      actorId: session.user.id,
      reason: parsed.data.reason,
    });
    return { success: true, data: result };
  } catch (error) {
    logError('Admin anonymization failed', error, {
      action: 'adminAnonymizeUser',
      userId: parsed.data.userId,
    });
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message:
          error instanceof Error ? error.message : 'Anonymization failed',
      },
    };
  }
}
