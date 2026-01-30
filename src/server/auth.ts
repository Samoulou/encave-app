import { headers } from 'next/headers';
import { auth as betterAuth } from '@/server/better-auth';
import { db } from '@/server/db';
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
    preferredLocale?: Locale;
  };
}

/**
 * Get the current session using Better Auth's API
 * This maintains the same API as the previous NextAuth `auth()` function
 */
export async function auth(): Promise<Session | null> {
  try {
    const session = await betterAuth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    // Better Auth session includes basic user info, but we need role and preferredLocale
    // which are custom fields. Fetch them from the database.
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        preferredLocale: true,
      },
    });

    if (!user) {
      return null;
    }

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
