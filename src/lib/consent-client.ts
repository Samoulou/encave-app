import { CONSENT_COOKIE_NAME, CONSENT_VERSION } from '@/lib/constants/consent';

interface ConsentCookie {
  analytics: boolean;
  version: string;
}

/** Fired on `window` by the cookie banner when the visitor decides. */
export const CONSENT_UPDATED_EVENT = 'encave-consent-updated';

export function readConsent(): ConsentCookie | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`))
    ?.split('=')[1];
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as ConsentCookie;
  } catch {
    return null;
  }
}

/**
 * True only when the visitor accepted analytics for the CURRENT consent
 * version — the single gate for every consent-based tool (PostHog,
 * Sentry Session Replay).
 */
export function hasAnalyticsConsent(): boolean {
  const consent = readConsent();
  return !!consent?.analytics && consent.version === CONSENT_VERSION;
}
