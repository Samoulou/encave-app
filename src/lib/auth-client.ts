import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client for React components
 * Use these hooks and functions in client components
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3000',
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
