'use server';

/**
 * Auth Server Actions
 *
 * NOTE: Login and registration are now handled directly by the Better Auth client
 * in the LoginForm and RegisterForm components. The client calls the Better Auth
 * API routes which properly set signed session cookies.
 *
 * These server actions are kept for reference and potential future use cases
 * where server-side auth operations are needed (e.g., admin operations).
 */

import { headers } from 'next/headers';
import { auth } from '@/server/better-auth';

/**
 * Sign out the current user (server-side)
 * Use this when you need to sign out from a server action context.
 * For client-side signout, use signOut() from '@/lib/auth-client'.
 */
export async function logoutAction(): Promise<void> {
  try {
    const headersList = await headers();
    await auth.api.signOut({
      headers: headersList,
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
}
