import { headers } from 'next/headers';
import { auth as betterAuth } from '@/server/better-auth';
import type { UserRole, Locale } from '@prisma/client';

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
 */
export async function auth(): Promise<Session | null> {
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
    console.error('Auth error:', error);
    return null;
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
    console.error('Sign out error:', error);
  }
}
