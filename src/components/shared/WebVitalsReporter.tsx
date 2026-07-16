'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { capturePostHog } from '@/lib/posthog-client';

/**
 * Field Web Vitals → PostHog (P-16 / WS-F, L-213). Lab numbers (LHCI) run
 * against staging; this is the REAL-user distribution the NFR ultimately
 * cares about. Pure client island mounted in the locale layout — renders
 * nothing, never touches ISR. Consent-safe: capturePostHog no-ops until
 * the analytics consent initializes posthog-js.
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    capturePostHog('web_vitals', {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_rating: metric.rating,
      metric_id: metric.id,
      navigation_type: metric.navigationType,
      pathname: window.location.pathname,
    });
  });

  return null;
}
