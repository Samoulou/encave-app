'use client';

import { CalendarCheck, CalendarClock, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { BookingSummary } from '@/server/queries/booking.queries';

interface BookingSummaryCardsProps {
  summary: BookingSummary;
}

/**
 * KPI summary cards for the bookings dashboard.
 * Displays: Total Bookings (month), Upcoming (7 days), Guests expected (7 days).
 * The former "occupancy rate" card was a placeholder formula and was removed
 * (L-011); a real 30-day fill rate arrives with persisted occurrences (L-130).
 */
export function BookingSummaryCards({ summary }: BookingSummaryCardsProps) {
  const t = useTranslations('bookings.summary');

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

      {/* Guests expected (7 Days) Card */}
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t('weekGuests')}
          </p>
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <p className="text-3xl font-bold text-foreground">
            {summary.weekGuests}
          </p>
        </div>
      </div>
    </div>
  );
}
