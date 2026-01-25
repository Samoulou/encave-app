'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportCSVButton } from '@/components/features/booking/dashboard/ExportCSVButton';

/**
 * Page header for the bookings dashboard.
 * Contains title and action buttons (Export CSV, Add Booking).
 */
export function BookingsPageHeader() {
  const locale = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-[#1a0f12] text-3xl font-black tracking-[-0.033em]">
        Bookings
      </h1>
      <div className="flex items-center gap-3">
        <ExportCSVButton />
        <Button asChild className="gap-2">
          <Link href={`/${locale}/dashboard/bookings/new`}>
            <Plus className="h-4 w-4" />
            <span>Add Booking</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
