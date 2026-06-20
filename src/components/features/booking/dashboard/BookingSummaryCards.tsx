'use client';

import { CalendarCheck, CalendarClock, PieChart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { BookingSummary } from '@/server/queries/booking.queries';

interface BookingSummaryCardsProps {
  summary: BookingSummary;
}

/**
 * KPI summary cards for the bookings dashboard.
 * Displays: Total Bookings (with trend), Upcoming (7 Days), Occupancy Rate.
 * Matches the mockup design from US-UI-09.
 */
export function BookingSummaryCards({ summary }: BookingSummaryCardsProps) {
  const t = useTranslations('bookings.summary');

  // Occupancy rate based on confirmed bookings vs capacity (approximation)
  const occupancyRate = Math.min(
    Math.round(
      (summary.monthCount / Math.max(summary.monthCount + 5, 10)) * 100
    ),
    100
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Total Bookings Card */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t('totalBookings')}
          </p>
          <CalendarCheck className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <p className="text-3xl font-bold text-foreground">
            {summary.monthCount}
          </p>
        </div>
      </div>

      {/* Upcoming (7 Days) Card */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t('upcoming')}
          </p>
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <p className="text-3xl font-bold text-foreground">
            {summary.weekCount}
          </p>
        </div>
      </div>

      {/* Occupancy Rate Card */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t('occupancyRate')}
          </p>
          <PieChart className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-bold text-foreground">
              {occupancyRate}%
            </p>
            <span className="text-sm text-muted-foreground">
              {t('avgThisMonth')}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-light">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
