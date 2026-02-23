'use client';

import { EarningsPeriodSelector } from './EarningsPeriodSelector';
import { ExportEarningsButton } from './ExportEarningsButton';

/**
 * Page header for the earnings dashboard.
 * Contains breadcrumb, title, subtitle, period selector, and export button.
 * Matches the mockup design from US-UI-10.
 */
export function EarningsPageHeader() {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb - visible on larger screens, in-page for mobile */}
      <nav className="text-sm">
        <ol className="flex items-center gap-2">
          <li>
            <a href="/dashboard" className="text-[#915564] hover:text-primary transition-colors">
              Dashboard
            </a>
          </li>
          <li className="text-[#915564]/50" aria-hidden="true">/</li>
          <li>
            <span className="font-medium text-foreground">Earnings</span>
          </li>
        </ol>
      </nav>

      {/* Header with title and controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-foreground">
            Earnings
          </h1>
          <p className="text-[#915564] text-base">
            Track your revenue streams and payout history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <EarningsPeriodSelector defaultValue="this_year" />
          <ExportEarningsButton variant="primary" />
        </div>
      </div>
    </div>
  );
}
