import type { Metric } from 'web-vitals';

/**
 * Core Web Vitals thresholds (in milliseconds)
 * LCP (Largest Contentful Paint): Good < 2500ms
 * FID (First Input Delay): Good < 100ms
 * CLS (Cumulative Layout Shift): Good < 0.1
 * FCP (First Contentful Paint): Good < 1800ms
 * TTFB (Time to First Byte): Good < 800ms
 */
const vitalsThresholds = {
  LCP: 2500,
  FID: 100,
  CLS: 0.1,
  FCP: 1800,
  TTFB: 800,
  INP: 200, // Interaction to Next Paint
};

type VitalName = keyof typeof vitalsThresholds;

function isGoodScore(name: string, value: number): boolean {
  const threshold = vitalsThresholds[name as VitalName];
  return threshold !== undefined ? value <= threshold : true;
}

/**
 * Reports web vitals to analytics or monitoring service.
 * This function is called by Next.js for each web vital metric.
 */
export function reportWebVitals(metric: Metric) {
  const isGood = isGoodScore(metric.name, metric.value);

  // Log to console in development for debugging Web Vitals metrics
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console -- Development-only logging for Web Vitals debugging
    console.log(
      `[Web Vital] ${metric.name}: ${metric.value.toFixed(2)} ${isGood ? '✓' : '✗'}`
    );
  }

  // Send to analytics (Vercel Analytics handles this automatically)
  // For custom analytics, uncomment below:
  // sendToAnalytics(metric);

  // Send to Sentry for performance monitoring (if configured)
  if (typeof window !== 'undefined' && 'Sentry' in window) {
    // Sentry will capture this if performance monitoring is enabled
  }
}

/**
 * Custom analytics sender (example implementation)
 * Uncomment usage in reportWebVitals to enable
 */
// eslint-disable-next-line no-unused-vars
function _sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  });

  // Use Navigator.sendBeacon for reliable delivery
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/vitals', body);
  } else {
    fetch('/api/analytics/vitals', {
      body,
      method: 'POST',
      keepalive: true,
    });
  }
}
