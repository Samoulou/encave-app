import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Authentication (Better Auth)
  // BETTER_AUTH_SECRET is required in production
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),

  // OAuth Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // P-14 (D5): Apple OAuth removed — Google + email OTP suffice at launch.

  // Vercel automatic environment variables
  VERCEL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  NEXT_PUBLIC_VERCEL_URL: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  // Svix signing secret of the Resend webhook (open/click tracking, P-07).
  // Unset = webhook route rejects everything; sending is unaffected.
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  // Internal escalation inbox (P-10): a sur-mesure request unanswered > 48h
  // emails Sam here. Unset = escalation job skips cleanly (no throw).
  ADMIN_ALERT_EMAIL: z.string().email().optional(),
  // Reply-To of every outgoing email. The sender is noreply@encave.ch (no
  // inbox): without this header a client answering a confirmation, a
  // security notice or a no-show email writes into the void. MUST be a
  // monitored mailbox. A send may still override it (contact form → sender).
  // An empty value (EMAIL_REPLY_TO="") counts as unset → default applies;
  // a malformed address still fails the boot.
  EMAIL_REPLY_TO: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().email().default('support@encave.ch')
  ),

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

  // Launch gate (P-16 / WS-I, L-189). The ONLY env-based feature flag:
  // the Edge middleware cannot read the DB flag table. Anything but the
  // string 'false' keeps encave.ch on the Coming Soon page (fail-closed).
  // Read directly via process.env in src/middleware.ts (Edge runtime);
  // declared here so the variable is documented and validated.
  COMING_SOON: z.string().optional(),

  // Write-freeze switch (runbook restauration-db.md). The string 'true'
  // makes the Edge middleware serve /[locale]/maintenance for every page
  // request and answer 503 + Retry-After on mutating API routes — except
  // /api/webhooks/**, /api/cron/** and /api/health, which must keep
  // answering (Stripe disables an endpoint that keeps failing). Read via
  // process.env in src/middleware.ts (Edge runtime), like COMING_SOON:
  // flip = Vercel env change + redeploy. Declared here to be validated.
  MAINTENANCE_MODE: z.string().optional(),

  // Sentry (Error Tracking)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Analytics (PostHog)
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),

  // Mapbox
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),

  // Analytics (Vercel)
  NEXT_PUBLIC_VERCEL_ANALYTICS_ID: z.string().optional(),

  // SEO / Site URL
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // E2E simulation switch (Playwright / k6): fake Stripe sessions, rate
  // limits off, /api/test/* open. Read through isE2ETest() in
  // src/lib/e2e-mode.ts — refused on the production deployment (below).
  E2E_TEST: z.string().optional(),

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

  // E2E_TEST disables every rate limit and replaces Stripe with synthetic
  // sessions — it must never boot on the production deployment.
  if (data.VERCEL_ENV === 'production' && data.E2E_TEST === 'true') {
    console.error('❌ E2E_TEST=true is forbidden when VERCEL_ENV=production');
    throw new Error('E2E_TEST must not be enabled in production');
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
