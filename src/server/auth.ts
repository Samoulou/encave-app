import { cache } from 'react';
import { headers } from 'next/headers';
import { auth as betterAuth } from '@/server/better-auth';
import { isSessionPastRoleWindow } from '@/server/auth-hardening';
import { db } from '@/server/db';
import type { UserRole, Locale } from '@prisma/client';
import { logError, logInfo } from '@/lib/logger';

/**
 * Session type that matches the previous NextAuth session shape
 * for backward compatibility with existing code
 */
export interface Session {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    preferredLocale: Locale;
    // P-14 (L-152): TOTP status. Native better-auth field — may lag the DB by
    // up to the cookieCache window (5 min). For the admin enforcement GATE use
    // getCurrentUserTwoFactorEnabled() (fresh) to avoid a setup redirect loop.
    twoFactorEnabled: boolean;
    // Native better-auth field. Gates the guest-booking-by-email paths so an
    // unverified sign-up can't claim someone else's guest bookings. May lag the
    // DB by the cookieCache window (5 min) after the link is clicked.
    emailVerified: boolean;
  };
}

/**
 * Get the current session using Better Auth's API
 * This maintains the same API as the previous NextAuth `auth()` function
 *
 * Note: role and preferredLocale are defined as additionalFields in Better Auth config,
 * so they are included in the session automatically - no extra DB query needed.
 *
 * React.cache: one better-auth resolution per request no matter how many
 * layers call auth() in the same render tree (P-06 — the admin layout
 * alone used to resolve the session twice via isCurrentUserSuspended).
 */
/**
 * Raw better-auth session (with session metadata: createdAt, expiresAt) —
 * one resolution per request, shared by auth() and the G-3 boundary check.
 */
const getRawSession = cache(async () =>
  betterAuth.api.getSession({
    headers: await headers(),
  })
);

export const auth = cache(async function auth(): Promise<Session | null> {
  try {
    const session = await getRawSession();

    if (!session?.user) {
      return null;
    }

    // additionalFields (role, preferredLocale) are included in session.user
    const user = session.user as typeof session.user & {
      role: UserRole;
      preferredLocale: Locale;
      twoFactorEnabled?: boolean;
      emailVerified?: boolean;
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        preferredLocale: user.preferredLocale,
        twoFactorEnabled: user.twoFactorEnabled ?? false,
        emailVerified: user.emailVerified ?? false,
      },
    };
  } catch (error) {
    // Static rendering: headers() throws a DYNAMIC_SERVER_USAGE bailout.
    // RETHROW it (P-06): swallowing it made Next believe protected pages
    // were static — it prerendered them as anonymous login-redirects and
    // would have served that cached redirect to logged-in users. Next
    // catches the rethrown bailout and correctly marks the route dynamic.
    // Public ISR pages never call auth() anymore (header is decoupled).
    if (
      error instanceof Error &&
      (error.message.includes('DYNAMIC_SERVER_USAGE') ||
        error.message.includes('Dynamic server usage') ||
        (error as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE')
    ) {
      throw error;
    }
    logError('Auth error', error, { action: 'auth' });
    return null;
  }
});

export async function isCurrentUserSuspended(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { suspendedAt: true },
  });

  return user?.suspendedAt !== null && user?.suspendedAt !== undefined;
}

/**
 * Fresh (non-cached) read of the current user's TOTP status (P-14 / L-152).
 * The admin enforcement gate + the TOTP setup page both use this so that a
 * just-enabled admin isn't bounced back to setup for the cookieCache window.
 */
export async function getCurrentUserTwoFactorEnabled(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });

  return user?.twoFactorEnabled ?? false;
}

/**
 * G-3 (P-16 / WS-G): TRUE when the current session outlived its per-role
 * window (ADMIN 7 d). The login-time cap (session create hook) is undone
 * by better-auth's sliding refresh, which resets `expiresAt` to the
 * global 90 d — so the boundary re-checks the session's AGE instead.
 * Non-admin roles: the slide is accepted (documented L-153 trade-off,
 * e.g. the winemaker offline scan device must not lose its session).
 */
export async function isCurrentAdminSessionExpired(): Promise<boolean> {
  try {
    const session = await getRawSession();
    if (!session?.session || !session.user) return false;
    const role = (session.user as { role?: UserRole }).role;
    if (role !== 'ADMIN') return false;
    const expired = isSessionPastRoleWindow(session.session.createdAt, role);
    if (expired) {
      logInfo('admin session past its 7d window — forcing re-login (G-3)', {
        action: 'isCurrentAdminSessionExpired',
        userId: session.user.id,
        sessionCreatedAt: String(session.session.createdAt),
      });
    }
    return expired;
  } catch (error) {
    logError('admin session age check failed', error, {
      action: 'isCurrentAdminSessionExpired',
    });
    // Fail closed at the admin boundary.
    return true;
  }
}

/**
 * Sign out using Better Auth's API
 */
export async function signOutSession(): Promise<void> {
  try {
    await betterAuth.api.signOut({
      headers: await headers(),
    });
  } catch (error) {
    logError('Sign out error', error, { action: 'signOutSession' });
  }
}
