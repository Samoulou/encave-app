/**
 * Deferred browser Sentry (perf): the SDK is ~107 kB gz / 350 kB parsed.
 * Statically imported from the client entry it sat in the bundle shared by
 * EVERY page and cost 0.6–1.2 s of main-thread time on a mid-range phone
 * before the first interaction. It is now a separate chunk fetched after
 * the first user interaction (or after a few idle seconds).
 *
 * Nothing is lost in the gap: `sentry.client.config.ts` buffers the
 * errors/rejections raised before the SDK is ready and hands them to
 * `loadSentryClient`, which reports them once initialized.
 *
 * Client code must go through `loadSentryClient()` — a static
 * `import * as Sentry from '@sentry/nextjs'` in a client component would
 * pull the SDK back into the initial bundle.
 */
import {
  CONSENT_UPDATED_EVENT,
  hasAnalyticsConsent,
} from '@/lib/consent-client';

type SentryModule = typeof import('@sentry/nextjs');

let loading: Promise<SentryModule | null> | null = null;

/** Errors captured before the SDK was ready (filled by the bootstrap). */
const earlyErrors: unknown[] = [];
const MAX_EARLY_ERRORS = 20;

export function bufferEarlyError(error: unknown): void {
  if (earlyErrors.length < MAX_EARLY_ERRORS) {
    earlyErrors.push(error);
  }
}

let replayRequested = false;

/**
 * Session Replay records the DOM: it is an analytics-grade tool and only
 * runs for visitors who accepted analytics cookies (the privacy policy
 * says so). It was previously fetched and buffering for EVERY visitor.
 * L-205: the integration comes from the Sentry CDN, never from our bundles;
 * the sample rates configured in init() apply once it is added.
 */
function enableReplayWithConsent(Sentry: SentryModule): void {
  const tryEnable = () => {
    if (replayRequested || !hasAnalyticsConsent()) return;
    replayRequested = true;
    window.removeEventListener(CONSENT_UPDATED_EVENT, tryEnable);
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
        // Replay is best-effort — ignore load failures (offline, blocker).
      });
  };

  window.addEventListener(CONSENT_UPDATED_EVENT, tryEnable);
  tryEnable();
}

/** Callbacks waiting for the SDK — see `onSentryReady`. */
const readyCallbacks: Array<(_sentry: SentryModule) => void> = [];
let readyModule: SentryModule | null = null;

/**
 * Run `callback` with the SDK once it is initialized — WITHOUT triggering
 * the download. For code that runs on every page at hydration (user
 * tagging): it must not pull the SDK forward.
 */
export function onSentryReady(callback: (_sentry: SentryModule) => void): void {
  if (readyModule) {
    callback(readyModule);
    return;
  }
  readyCallbacks.push(callback);
}

/**
 * Load + initialize the browser SDK once. Resolves to `null` when no DSN is
 * configured or the chunk cannot be fetched (offline, ad-blocker) — callers
 * treat Sentry as best-effort.
 */
export function loadSentryClient(): Promise<SentryModule | null> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return Promise.resolve(null);
  }

  if (!loading) {
    loading = import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.init({
          dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

          // Environment: use Vercel env if available, fallback to NODE_ENV
          environment:
            process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

          // Performance: sample 20% of transactions in production
          tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

          // Session Replay: 10% of sessions, 100% of sessions with errors —
          // only for visitors who accepted analytics (enableReplayWithConsent).
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

        readyModule = Sentry;
        for (const callback of readyCallbacks.splice(0)) {
          callback(Sentry);
        }

        // Report what happened before the SDK was ready.
        for (const error of earlyErrors.splice(0)) {
          Sentry.captureException(error);
        }

        enableReplayWithConsent(Sentry);

        return Sentry;
      })
      .catch(() => null);
  }

  return loading;
}
