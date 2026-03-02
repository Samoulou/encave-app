import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable Sentry when DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment: use Vercel env if available, fallback to NODE_ENV
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  // Performance: sample 20% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  debug: false,
});
