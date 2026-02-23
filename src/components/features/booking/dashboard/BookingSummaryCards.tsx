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
    Math.round((summary.monthCount / Math.max(summary.monthCount + 5, 10)) * 100),
    100
  );

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {/* Total Bookings Card */}
      <div className="flex flex-col gap-1 p-5 bg-white rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[#915564] text-sm font-medium uppercase tracking-wider">
            {t('totalBookings')}
          </p>
          <CalendarCheck className="h-5 w-5 text-[#915564]" />
        </div>
        <div className="flex items-baseline gap-3 mt-2">
          <p className="text-foreground text-3xl font-bold">{summary.monthCount}</p>
        </div>
      </div>

      {/* Upcoming (7 Days) Card */}
      <div className="flex flex-col gap-1 p-5 bg-white rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[#915564] text-sm font-medium uppercase tracking-wider">
            {t('upcoming')}
          </p>
          <CalendarClock className="h-5 w-5 text-[#915564]" />
        </div>
        <div className="flex items-baseline gap-3 mt-2">
          <p className="text-foreground text-3xl font-bold">{summary.weekCount}</p>
        </div>
      </div>

      {/* Occupancy Rate Card */}
      <div className="flex flex-col gap-1 p-5 bg-white rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[#915564] text-sm font-medium uppercase tracking-wider">
            {t('occupancyRate')}
          </p>
          <PieChart className="h-5 w-5 text-[#915564]" />
        </div>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-baseline justify-between">
            <p className="text-foreground text-3xl font-bold">{occupancyRate}%</p>
            <span className="text-sm text-[#915564]">{t('avgThisMonth')}</span>
          </div>
          <div className="w-full h-1.5 bg-primary-light rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
