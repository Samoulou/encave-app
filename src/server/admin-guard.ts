import { UserRole } from '@prisma/client';
import { auth, isCurrentAdminSessionExpired } from '@/server/auth';
import type { ActionResult } from '@/types/actions';

/**
 * Shared admin gate for server actions. Lives OUTSIDE any 'use server'
 * file on purpose: exported members of action files become callable
 * RPC endpoints, and a guard has no business being one.
 */
export async function requireAdmin(): Promise<
  | ActionResult<{ adminId: string }>
  | { success: true; data: { adminId: string } }
> {
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
  // P-16 (G-3): the layout gate only covers page renders — a stale tab's
  // server actions land here directly, so the 7 d session-age cap must
  // hold at the action boundary too (review finding).
  if (await isCurrentAdminSessionExpired()) {
    return {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Session expired' },
    };
  }
  return { success: true, data: { adminId: session.user.id } };
}
