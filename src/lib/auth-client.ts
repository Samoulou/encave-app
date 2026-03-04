import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client for React components
 * Always uses the current page origin so auth API calls are never cross-origin.
 */
export const authClient = createAuthClient();

// Export individual functions for easier imports
export const { signIn, signUp, signOut, useSession, getSession } = authClient;

// Helper types
export type AuthSession = ReturnType<typeof useSession>;
