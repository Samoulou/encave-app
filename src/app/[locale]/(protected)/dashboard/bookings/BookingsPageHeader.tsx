'use client';

import { ExportCSVButton } from '@/components/features/booking/dashboard/ExportCSVButton';

/**
 * Page header for the bookings dashboard.
 * Contains title and export CSV action button.
 */
export function BookingsPageHeader() {

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-display text-foreground text-3xl font-black tracking-[-0.033em]">
        Bookings
      </h1>
      <div className="flex items-center gap-3">
        <ExportCSVButton />
      </div>
    </div>
  );
}
