import { UserRole } from '@prisma/client';
import { auth } from '@/server/auth';
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
  return { success: true, data: { adminId: session.user.id } };
}
