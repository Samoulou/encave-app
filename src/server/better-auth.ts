import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { db } from '@/server/db';
import bcrypt from 'bcryptjs';

/**
 * Build trusted origins dynamically from environment
 */
function getTrustedOrigins(): string[] {
  const origins: string[] = [];

  // Add configured URL (production domain)
  if (process.env.BETTER_AUTH_URL) {
    origins.push(process.env.BETTER_AUTH_URL);
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
      'http://localhost:3002',
    );
  }

  return origins;
}

/**
 * Build social providers config - only include providers with valid credentials
 */
function getSocialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    providers.apple = {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    };
  }

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

  // Session configuration (matches previous 7-day sessions)
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache for 5 minutes
    },
  },

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    // Use bcryptjs for password hashing (compatible with existing hashes)
    password: {
      hash: async (password: string) => {
        return bcrypt.hash(password, 10);
      },
      verify: async ({ password, hash }: { password: string; hash: string }) => {
        return bcrypt.compare(password, hash);
      },
    },
  },

  // OAuth providers - only included if credentials are configured
  socialProviders: getSocialProviders(),

  // User configuration
  // Note: role and preferredLocale are custom fields with defaults defined in Prisma schema.
  // Better Auth doesn't need to know about them - Prisma handles the defaults.
  // The auth() wrapper in src/server/auth.ts fetches them from DB when needed.

  // Account linking - allow linking without email verification
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'apple'],
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
export type User = typeof auth.$Infer.Session['user'];

// Export type for handler
export type BetterAuth = typeof auth;
