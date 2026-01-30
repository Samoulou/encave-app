import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client for React components
 *
 * IMPORTANT: Set NEXT_PUBLIC_BETTER_AUTH_URL in Vercel environment variables
 * Production: https://encave.ch
 * Preview: Will use the deployment URL automatically via Vercel system env vars
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
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
