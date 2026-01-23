'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CalendarX2, Sparkles } from 'lucide-react';

/**
 * Empty state for bookings dashboard when there are no bookings.
 * Matches the mockup design from US-UI-09.
 */
export function BookingsEmptyState() {
  const locale = useLocale();

  return (
    <div className="bg-white rounded-xl border border-[#e5d2d7] shadow-sm">
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#f2e9eb]">
          <CalendarX2 className="h-10 w-10 text-[#915564]" />
        </div>
        <h3 className="text-xl font-bold text-[#1a0f12]">
          No bookings yet
        </h3>
        <p className="mt-2 max-w-md text-[#915564]">
          When customers book your experiences, they&apos;ll appear here.
        </p>
        <Link
          href={`/${locale}/dashboard/experiences`}
          className="mt-8 inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Manage Experiences
        </Link>
      </div>
    </div>
  );
}
