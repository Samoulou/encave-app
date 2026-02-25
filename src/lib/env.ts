import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Authentication (Better Auth)
  // BETTER_AUTH_SECRET is required in production
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_BETTER_AUTH_URL: z.string().url().optional(),

  // OAuth Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),

  // Vercel automatic environment variables
  VERCEL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  NEXT_PUBLIC_VERCEL_URL: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),

  // Storage (Vercel Blob)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Rate Limiting (Upstash) - optional, falls back to in-memory
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  PLATFORM_COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.12),

  // Cron Jobs
  CRON_SECRET: z.string().min(32).optional(),

  // Sentry (Error Tracking)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Analytics (PostHog)
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),

  // Analytics (Vercel)
  NEXT_PUBLIC_VERCEL_ANALYTICS_ID: z.string().optional(),

  // SEO / Site URL
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

function getEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors
    );
    throw new Error('Invalid environment variables');
  }

  const data = parsed.data;

  // BETTER_AUTH_SECRET is required in production
  if (data.NODE_ENV === 'production' && !data.BETTER_AUTH_SECRET) {
    console.error('❌ BETTER_AUTH_SECRET is required in production');
    throw new Error('BETTER_AUTH_SECRET is required in production');
  }

  return data;
}

export const env = getEnv();

/**
 * Get the base URL for the application.
 * Priority: BETTER_AUTH_URL > VERCEL_URL > localhost
 */
export function getBaseUrl(): string {
  if (env.BETTER_AUTH_URL) {
    return env.BETTER_AUTH_URL;
  }

  // On Vercel, use the automatic VERCEL_URL
  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  // Local development fallback
  return 'http://localhost:3000';
}
