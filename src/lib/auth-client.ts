import { createAuthClient } from 'better-auth/react';

/**
 * Get the base URL for auth API calls
 * In production, use empty string (relative URL) to use same origin
 * This avoids CSP issues and works with Vercel preview deployments
 */
function getBaseURL(): string {
  // Explicit URL takes priority (useful for cross-domain setups)
  if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
    return process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  }
  // In browser, use empty string for relative URLs (same origin)
  if (typeof window !== 'undefined') {
    return '';
  }
  // SSR fallback (rarely used for auth client)
  return 'http://localhost:3000';
}

/**
 * Better Auth client for React components
 * Use these hooks and functions in client components
 */
export const authClient = createAuthClient({
  baseURL: getBaseURL(),
});

// Export individual functions for easier imports
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;

// Helper types
export type AuthSession = ReturnType<typeof useSession>;
