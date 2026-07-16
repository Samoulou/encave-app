import { betterAuth } from 'better-auth';
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
import { authHardening, sessionWindowMsForRole } from '@/server/auth-hardening';
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

  // Per-role session length at login (L-153) — see sessionWindowMsForRole.
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { role: true },
          });
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
    password: {
      hash: (password) => bcrypt.hash(password, SALT_ROUNDS),
      verify: ({ password, hash }) => bcrypt.compare(password, hash),
    },
  },

  // Custom user fields - included in session automatically
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'CLIENT',
      },
      preferredLocale: {
        type: 'string',
        defaultValue: 'FR',
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
    enabled: process.env.E2E_TEST !== 'true',
    storage: 'database',
    window: 60,
    max: 10,
    customRules: {
      '/sign-in/email': { window: 900, max: 5 }, // AUTH_RATE_LIMIT
      '/sign-in/email-otp': { window: 900, max: 5 },
      '/sign-up/email': { window: 3600, max: 3 }, // REGISTRATION_RATE_LIMIT
      '/email-otp/send-verification-otp': { window: 900, max: 5 },
      '/two-factor/verify-totp': { window: 900, max: 10 },
    },
  },

  // OAuth providers - only included if credentials are configured
  socialProviders: getSocialProviders(),

  // Account linking - allow linking without email verification
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
  },
});

// Use Better Auth's inferred types for type safety
export type Session = typeof auth.$Infer.Session;
export type User = (typeof auth.$Infer.Session)['user'];

// Export type for handler
export type BetterAuth = typeof auth;
