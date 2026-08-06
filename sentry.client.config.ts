import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable Sentry when DSN is configured
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment: use Vercel env if available, fallback to NODE_ENV
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  // Performance: sample 20% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Session Replay: capture 10% of sessions, 100% of sessions with errors.
  // The Replay integration itself is lazy-loaded below (L-205).
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.browserTracingIntegration()],

  // Filter out common non-actionable errors
  ignoreErrors: [
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    /^chrome-extension:\/\//,
    'ResizeObserver loop',
    'Non-Error promise rejection',
  ],

  debug: false,
});

// L-205: Session Replay is loaded lazily (fetched from the Sentry CDN after
// startup) so its ~50-60 kB gz never ship in the initial bundle. The sample
// rates configured in init() above still apply once the integration is added.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.lazyLoadIntegration('replayIntegration')
    .then((replayIntegration) => {
      Sentry.getClient()?.addIntegration(
        replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        })
      );
    })
    .catch(() => {
      // Replay is best-effort — ignore load failures (offline, ad-blocker).
    });
}
