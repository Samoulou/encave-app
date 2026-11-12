import { bufferEarlyError, loadSentryClient } from '@/lib/sentry-client';

/**
 * Browser Sentry bootstrap. The SDK itself is NOT imported here: it loads
 * as a separate chunk on the first user interaction, or after
 * SDK_IDLE_FALLBACK_MS when the visitor does nothing (see
 * src/lib/sentry-client.ts for the why). Until then, uncaught errors and
 * unhandled rejections are buffered and reported as soon as it is ready.
 *
 * Known trade-off: a visitor who leaves within the fallback delay without
 * interacting is not traced, and an error buffered for them is not sent.
 */
const SDK_IDLE_FALLBACK_MS = 8000;
const INTERACTION_EVENTS = [
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll',
] as const;

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const onError = (event: ErrorEvent) => {
    bufferEarlyError(event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    bufferEarlyError(event.reason);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    for (const name of INTERACTION_EVENTS) {
      window.removeEventListener(name, start);
    }

    const load = () => {
      void loadSentryClient().then(() => {
        // The SDK installs its own global handlers on init.
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
      });
    };
    // Never inside the interaction's own task (INP).
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(load, { timeout: 2000 });
    } else {
      setTimeout(load, 200);
    }
  };

  for (const name of INTERACTION_EVENTS) {
    window.addEventListener(name, start, { passive: true, once: true });
  }
  setTimeout(start, SDK_IDLE_FALLBACK_MS);
}
