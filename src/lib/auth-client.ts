import { createAuthClient } from 'better-auth/react';

/**
 * Get the base URL for auth API calls
 * Priority: NEXT_PUBLIC_BETTER_AUTH_URL > NEXT_PUBLIC_VERCEL_URL > localhost
 */
function getBaseURL(): string {
  if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
    return process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  }
  // Vercel provides this automatically in production/preview
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  // Development fallback
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
