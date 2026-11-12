import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, twoFactor } from 'better-auth/plugins';
import bcrypt from 'bcryptjs';
import { db } from '@/server/db';
import {
  sendOtpEmail,
  sendEmailVerificationEmail,
} from '@/server/services/email.service';
// P-16 / WS-G: G-1 (TOTP on OTP/social paths) + G-2 (email-change notice)
// hooks, and the per-role session windows (login stamp + G-3 boundary check).
import {
  authHardening,
  isSessionCreationBlocked,
  sessionWindowMsForRole,
} from '@/server/auth-hardening';
import { isE2ETest } from '@/lib/e2e-mode';
import type { Locale } from '@prisma/client';

const SALT_ROUNDS = 10;

/**
 * Build trusted origins dynamically from environment
 */
function getTrustedOrigins(): string[] {
  const origins: string[] = [];

  // Add configured URL (production domain)
  if (process.env.BETTER_AUTH_URL) {
    origins.push(process.env.BETTER_AUTH_URL);
  }

  // Add custom domain aliases (e.g. encave-dev.vercel.app, encave.ch)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    origins.push(process.env.NEXT_PUBLIC_BASE_URL);
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    origins.push(process.env.NEXT_PUBLIC_SITE_URL);
  }

  // Add Vercel URLs (automatically provided by Vercel)
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.VERCEL_BRANCH_URL) {
    origins.push(`https://${process.env.VERCEL_BRANCH_URL}`);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  // In development, add common localhost ports
  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002'
    );
  }

  return origins;
}

/**
 * Build social providers config - only include providers with valid credentials
 */
function getSocialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> =
    {};

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  // P-14 (D5): Apple OAuth removed — Google + email OTP suffice at launch.

  return providers;
}

/**
 * Better Auth configuration
 * Replaces NextAuth.js with full OAuth support and better DX
 */
export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),

  trustedOrigins: getTrustedOrigins(),

  // P-14 (L-152/L-150): TOTP (admin) + email OTP (login + password reset).
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 15, // 15 minutes
      storeOTP: 'hashed', // never store the OTP in clear (R-8)
      // OTP login must NOT silently create accounts — a mistyped email on the
      // "get a code" tab should fail, not fork a new CLIENT (review).
      disableSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        // better-auth 1.7 added the 'change-email' OTP purpose. It is only
        // reachable when emailOTP.changeEmail is enabled — it is NOT here
        // (email change goes through the link flow below, confirmed on the
        // current address). Refuse rather than mail a code for a flow we
        // never reviewed.
        if (type === 'change-email') {
          return;
        }
        const user = await db.user.findUnique({
          where: { email },
          select: { preferredLocale: true },
        });
        await sendOtpEmail(email, otp, type, user?.preferredLocale ?? 'FR');
      },
    }),
    twoFactor({
      issuer: 'EnCave',
      totpOptions: { digits: 6, period: 30 },
    }),
    // P-16 / WS-G: the built-in twoFactor hook only covers /sign-in/email —
    // this closes the OTP + OAuth-callback bypass (G-1) and posts the
    // email-change security notice (G-2).
    authHardening(),
  ],

  // Session configuration. Global expiresIn = the LONGEST role window (90d,
  // cookie max-age); per-role caps applied at login below (L-153).
  session: {
    expiresIn: 60 * 60 * 24 * 90, // 90 days (cookie max-age)
    updateAge: 60 * 60 * 24, // sliding refresh every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache for 5 minutes
    },
  },

  // Per-role session length at login (L-153) — see sessionWindowMsForRole —
  // and the central suspension gate: EVERY session of the app is minted
  // through this hook (password, email OTP, Google, TOTP verify, email
  // verification auto sign-in), so a suspended user can never obtain one.
  // Same single user read as before — no extra query.
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { role: true, suspendedAt: true },
          });
          if (isSessionCreationBlocked(user)) {
            // Thrown (not `return false`): several better-auth sign-in
            // routes do not null-check an aborted session and would answer
            // a 500; an APIError surfaces as a clean 403 everywhere.
            throw new APIError('FORBIDDEN', {
              code: 'ACCOUNT_SUSPENDED',
              message: 'This account is suspended',
            });
          }
          return {
            data: {
              ...session,
              expiresAt: new Date(
                Date.now() + sessionWindowMsForRole(user?.role)
              ),
            },
          };
        },
      },
    },
  },

  // Email/password authentication with bcrypt (matches seed data)
  emailAndPassword: {
    enabled: true,
    // A password reset is how a victim takes an account back — every
    // session that existed before it (a pre-registered attacker's included)
    // must die with the old password (audit M3).
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: (password) => bcrypt.hash(password, SALT_ROUNDS),
      verify: ({ password, hash }) => bcrypt.compare(password, hash),
    },
  },

  // Email verification (security): send a verification link on sign-up so the
  // guest-booking-by-email paths can require a verified address, closing the
  // account-takeover-by-email vector. `requireEmailVerification` is NOT set —
  // sign-in / auto-login stay unchanged; only the sensitive guest-booking
  // read/cancel/delete paths gate on `emailVerified`. Pre-existing accounts are
  // backfilled to verified in the accompanying migration so they are unaffected.
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmailVerificationEmail(
        user.email,
        user.name ?? user.email,
        url,
        ((user as { preferredLocale?: Locale }).preferredLocale ??
          'FR') as Locale
      );
    },
  },

  // Custom user fields - included in session automatically
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'CLIENT',
        // SECURITY: never client-settable. Without `input: false`
        // better-auth copies the field from the /sign-up/email and
        // /update-user bodies → anyone could self-assign ADMIN. Roles are
        // only ever written server-side (createWinery, founder invitation,
        // changeUserRole).
        input: false,
      },
      preferredLocale: {
        type: 'string',
        defaultValue: 'FR',
      },
      // Suspension travels with the session user so `auth()` can refuse a
      // suspended account WITHOUT an extra DB read per call (see
      // src/server/auth.ts). Never client-settable.
      suspendedAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
    // P-14 (L-151): self-service email change. Confirmation is sent to the
    // CURRENT email only when it is verified (better-auth); unverified users
    // change instantly — the old address then gets a security notice via
    // the authHardening after-hook (P-16 / G-2, closes R-2).
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendEmailVerificationEmail(
          user.email,
          user.name ?? newEmail,
          url,
          ((user as { preferredLocale?: Locale }).preferredLocale ??
            'FR') as Locale
        );
      },
    },
  },

  // Rate limiting (L-155): persistent (DB) so limits hold across serverless
  // instances. Per-endpoint rules use the AUTH_/REGISTRATION_RATE_LIMIT numbers.
  rateLimit: {
    enabled: !isE2ETest(),
    storage: 'database',
    window: 60,
    max: 10,
    customRules: {
      // Session read, fired by every page view (HeaderAuthSlot + useSession)
      // — the global 10/min rule 429'd ordinary browsing. `false` disables
      // rate limiting for the path (better-auth rate-limiter: a custom rule
      // resolving to `false` short-circuits). Read-only, cookie-bound: no
      // brute-force surface.
      '/get-session': false,
      '/sign-in/email': { window: 900, max: 5 }, // AUTH_RATE_LIMIT
      '/sign-in/email-otp': { window: 900, max: 5 },
      '/sign-up/email': { window: 3600, max: 3 }, // REGISTRATION_RATE_LIMIT
      '/email-otp/send-verification-otp': { window: 900, max: 5 },
      '/two-factor/verify-totp': { window: 900, max: 10 },
    },
  },

  // OAuth providers - only included if credentials are configured
  socialProviders: getSocialProviders(),

  // Account linking. Since better-auth 1.7 Google attaches to an existing
  // local account with the same email ONLY when that local email is
  // verified (`requireLocalEmailVerified`, default true — deprecated
  // option, the gate becomes unconditional; NEVER set it to false, guarded
  // by tests/unit/server/better-auth-prehijack.test.ts). An unverified row
  // proves nothing: auto-linking it would hand the real owner an account
  // whose password a squatter still knows (pre-account hijack,
  // GHSA-g38m-r43w-p2q7 / audit M3). The email-OTP sign-in is the recovery
  // path: it wipes the unproven credentials and sessions, then verifies
  // the address.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
      allowDifferentEmails: false,
    },
  },

  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    // Client IP for the rate limiter and session records. better-auth 1.7
    // only trusts SINGLE-value headers (no trustedProxies): Vercel
    // overwrites both with the real client address. Without a resolvable
    // IP every visitor would share one bucket per path.
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'],
    },
  },
});

// Use Better Auth's inferred types for type safety
export type Session = typeof auth.$Infer.Session;
export type User = (typeof auth.$Infer.Session)['user'];

// Export type for handler
export type BetterAuth = typeof auth;
