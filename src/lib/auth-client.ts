import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client for React components
 * If NEXT_PUBLIC_BETTER_AUTH_URL is not set, Better Auth will use the current origin
 */
export const authClient = createAuthClient(
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL
    ? { baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL }
    : {}
);

// Export individual functions for easier imports
export const { signIn, signUp, signOut, useSession, getSession } = authClient;

// Helper types
export type AuthSession = ReturnType<typeof useSession>;
