'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarX2, History, Search } from 'lucide-react';

interface ClientBookingEmptyStateProps {
  variant: 'upcoming' | 'past';
}

export function ClientBookingEmptyState({
  variant,
}: ClientBookingEmptyStateProps) {
  const locale = useLocale();
  const t = useTranslations('clientDashboard.bookings');

  const isUpcoming = variant === 'upcoming';
  const Icon = isUpcoming ? CalendarX2 : History;

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          {isUpcoming ? t('noUpcoming') : t('noPast')}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {isUpcoming ? t('noUpcomingDescription') : t('noPastDescription')}
        </p>
        {isUpcoming && (
          <Link
            href={`/${locale}/experiences`}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            <Search className="h-4 w-4" />
            {t('browseExperiences')}
          </Link>
        )}
      </div>
    </div>
  );
}
