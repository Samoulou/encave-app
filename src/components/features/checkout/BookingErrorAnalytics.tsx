'use client';

import { useEffect } from 'react';
import { capturePostHog } from '@/lib/posthog-client';

interface BookingErrorAnalyticsProps {
  /** Validated cause from the error page URL: 'payment' | 'hold-expired'. */
  cause: string;
}

/**
 * Funnel tracking for /reservation/erreur (P-04 review): since the Stripe
 * cancel_url points here, the `booking_payment_failed` event must fire on
 * this page — the old checkout `?error=` effect is dead. Renders nothing.
 */
export function BookingErrorAnalytics({ cause }: BookingErrorAnalyticsProps) {
  useEffect(() => {
    capturePostHog('booking_payment_failed', { cause });
  }, [cause]);

  return null;
}
