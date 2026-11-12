import { UserRole } from '@prisma/client';
import {
  auth,
  getCurrentUserSecurityState,
  isCurrentAdminSessionExpired,
} from '@/server/auth';
import type { ActionResult, ErrorCode } from '@/types/actions';

/**
 * Shared admin gate. Lives OUTSIDE any 'use server' file on purpose:
 * exported members of action files become callable RPC endpoints, and a
 * guard has no business being one.
 *
 * ONE decision (`checkAdminAccess`), two adapters:
 *  - `requireAdmin()` — server actions, returns an ActionResult;
 *  - `requireAdminPage()` in src/server/admin-page-guard.ts — every page
 *    under /admin, redirects / 404s exactly like admin/layout.tsx.
 *
 * Both are needed on top of the layout gate: a layout is NOT re-rendered
 * on client navigation (a crafted `Next-Router-State-Tree` request renders
 * a page without its layout), and server actions never render it at all.
 */
export type AdminAccessDenial =
  | 'UNAUTHENTICATED'
  | 'NOT_ADMIN'
  | 'SUSPENDED'
  | 'TOTP_REQUIRED'
  | 'SESSION_EXPIRED';

export type AdminAccess =
  | { ok: true; adminId: string }
  | { ok: false; reason: AdminAccessDenial };

/**
 * Same checks, same order as admin/layout.tsx: session → ADMIN role →
 * not suspended → TOTP enrolled (both read FRESH from the DB, not from the
 * cookie-cached session) → 7 d session-age cap (G-3). Fail-closed on a
 * missing user row.
 */
export async function checkAdminAccess(): Promise<AdminAccess> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, reason: 'UNAUTHENTICATED' };
  }
  if (session.user.role !== UserRole.ADMIN) {
    return { ok: false, reason: 'NOT_ADMIN' };
  }

  const state = await getCurrentUserSecurityState();
  if (!state) {
    return { ok: false, reason: 'UNAUTHENTICATED' };
  }
  if (state.suspended) {
    return { ok: false, reason: 'SUSPENDED' };
  }
  // P-14 (L-152): TOTP is mandatory for admins — at the action boundary
  // too, not only in the layout (an admin account without a second factor
  // must not be able to refund, change roles or anonymize).
  if (!state.twoFactorEnabled) {
    return { ok: false, reason: 'TOTP_REQUIRED' };
  }
  // P-16 (G-3): the layout gate only covers page renders — a stale tab's
  // server actions land here directly, so the 7 d session-age cap must
  // hold at the action boundary too (review finding).
  if (await isCurrentAdminSessionExpired()) {
    return { ok: false, reason: 'SESSION_EXPIRED' };
  }

  return { ok: true, adminId: session.user.id };
}

const DENIAL_ERRORS: Record<
  AdminAccessDenial,
  { code: ErrorCode; message: string }
> = {
  UNAUTHENTICATED: { code: 'UNAUTHORIZED', message: 'Please sign in' },
  NOT_ADMIN: { code: 'FORBIDDEN', message: 'Admin access required' },
  SUSPENDED: { code: 'FORBIDDEN', message: 'Account suspended' },
  TOTP_REQUIRED: {
    code: 'FORBIDDEN',
    message: 'Two-factor authentication is required',
  },
  SESSION_EXPIRED: { code: 'UNAUTHORIZED', message: 'Session expired' },
};

/** Admin gate for server actions. */
export async function requireAdmin(): Promise<
  | ActionResult<{ adminId: string }>
  | { success: true; data: { adminId: string } }
> {
  const access = await checkAdminAccess();
  if (!access.ok) {
    return { success: false, error: DENIAL_ERRORS[access.reason] };
  }
  return { success: true, data: { adminId: access.adminId } };
}
