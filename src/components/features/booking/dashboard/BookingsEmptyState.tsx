'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarX2, Sparkles } from 'lucide-react';

/**
 * Empty state for bookings dashboard when there are no bookings.
 * Matches the mockup design from US-UI-09.
 */
export function BookingsEmptyState() {
  const locale = useLocale();
  const t = useTranslations('bookings.empty');

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm">
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-light">
          <CalendarX2 className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold text-foreground">
          {t('title')}
        </h3>
        <p className="mt-2 max-w-md text-muted-foreground">
          {t('description')}
        </p>
        <Link
          href={`/${locale}/dashboard/experiences`}
          className="mt-8 inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          {t('action')}
        </Link>
      </div>
    </div>
  );
}
