import { notFound, redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { checkAdminAccess } from '@/server/admin-guard';

/**
 * Page-level admin gate — call it FIRST in every page under
 * `src/app/[locale]/admin/**` (defence in depth, pre-launch audit B2).
 *
 * admin/layout.tsx alone does not protect a page: Next.js does not
 * re-render a layout whose segment already matches the client's
 * `Next-Router-State-Tree`, so a crafted RSC request renders the page —
 * and runs its queries — without the layout ever executing. The page (the
 * component that actually reads the data) must authorize itself.
 *
 * Outcomes mirror admin/layout.tsx one for one, so whichever of the two
 * gates fires first on a regular navigation, the user sees the same thing:
 *  - no session          → login (returns to /admin)
 *  - not an ADMIN        → 404
 *  - suspended           → home
 *  - TOTP not enrolled   → /admin-setup/2fa
 *  - session past 7 d    → /api/auth/session-expired (revokes, then login)
 *
 * Not a 'use server' file: a guard must never be an RPC endpoint.
 */
export async function requireAdminPage(): Promise<{ adminId: string }> {
  const access = await checkAdminAccess();
  if (access.ok) {
    return { adminId: access.adminId };
  }

  if (access.reason === 'NOT_ADMIN') {
    notFound();
  }

  const locale = await getLocale();
  if (access.reason === 'UNAUTHENTICATED') {
    redirect(`/${locale}/login?callbackUrl=/${locale}/admin`);
  }
  if (access.reason === 'SUSPENDED') {
    redirect(`/${locale}`);
  }
  if (access.reason === 'TOTP_REQUIRED') {
    redirect(`/${locale}/admin-setup/2fa`);
  }
  // SESSION_EXPIRED — the route handler revokes the session (an RSC render
  // cannot clear cookies) then lands on the login page.
  redirect(`/api/auth/session-expired?locale=${locale}`);
}
