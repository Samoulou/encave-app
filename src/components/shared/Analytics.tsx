'use client';

import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

/**
 * Analytics component that wraps Vercel Analytics and Speed Insights.
 * Only renders on Vercel deployments to avoid 404 console errors locally.
 */
export function Analytics() {
  if (!process.env.NEXT_PUBLIC_VERCEL_URL) {
    return null;
  }

  return (
    <>
      <VercelAnalytics />
      <SpeedInsights />
    </>
  );
}
