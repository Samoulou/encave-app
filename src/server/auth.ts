import { cache } from 'react';
import { headers } from 'next/headers';
import { auth as betterAuth } from '@/server/better-auth';
import { db } from '@/server/db';
import type { UserRole, Locale } from '@prisma/client';
import { logError } from '@/lib/logger';

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
export const auth = cache(async function auth(): Promise<Session | null> {
  try {
    const session = await betterAuth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    // additionalFields (role, preferredLocale) are included in session.user
    const user = session.user as typeof session.user & {
      role: UserRole;
      preferredLocale: Locale;
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        preferredLocale: user.preferredLocale,
      },
    };
  } catch (error) {
    // Handle static rendering - headers() throws during SSG/ISR
    if (
      error instanceof Error &&
      (error.message.includes('DYNAMIC_SERVER_USAGE') ||
        error.message.includes('Dynamic server usage') ||
        (error as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE')
    ) {
      return null;
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
