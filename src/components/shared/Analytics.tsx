'use client';

import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

/**
 * Analytics component that wraps Vercel Analytics and Speed Insights.
 * Add this to your root layout to enable analytics.
 *
 * To enable analytics:
 * 1. Install packages: npm install @vercel/analytics @vercel/speed-insights
 * 2. Enable Analytics in your Vercel project dashboard
 */
export function Analytics() {
  return (
    <>
      <VercelAnalytics />
      <SpeedInsights />
    </>
  );
}
