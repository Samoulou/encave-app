import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins';

/**
 * Better Auth client for React components.
 * Always uses the current page origin so auth API calls are never cross-origin.
 *
 * P-14 plugins:
 * - emailOTPClient → `authClient.emailOtp.sendVerificationOtp/resetPassword`,
 *   `signIn.emailOtp` (OTP login + OTP password reset).
 * - twoFactorClient → `authClient.twoFactor.enable/verifyTotp/disable/…`
 *   (admin TOTP). At login, `signIn.email` returns `data.twoFactorRedirect`
 *   when a 2FA step is required — the LoginForm routes to /login/2fa (kept
 *   in the form so the locale prefix is preserved).
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), twoFactorClient()],
});

// Export individual functions for easier imports
export const { signIn, signUp, signOut, useSession, getSession } = authClient;

// Helper types
export type AuthSession = ReturnType<typeof useSession>;
