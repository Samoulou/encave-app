import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Authentication (supports both AUTH_* and NEXTAUTH_* for compatibility)
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // Vercel automatic environment variables
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),

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

  return parsed.data;
}

export const env = getEnv();

/**
 * Get the base URL for the application.
 * Priority: AUTH_URL > NEXTAUTH_URL > VERCEL_URL > localhost
 */
export function getBaseUrl(): string {
  // Explicit AUTH_URL takes priority (NextAuth v5)
  if (env.AUTH_URL) {
    return env.AUTH_URL;
  }

  // Fallback to NEXTAUTH_URL (NextAuth v4 compatibility)
  if (env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL;
  }

  // On Vercel, use the automatic VERCEL_URL
  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  // Local development fallback
  return 'http://localhost:3000';
}
