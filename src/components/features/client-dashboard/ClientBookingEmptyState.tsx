'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarX2, History, Search } from 'lucide-react';

interface ClientBookingEmptyStateProps {
  variant: 'upcoming' | 'past';
}

export function ClientBookingEmptyState({ variant }: ClientBookingEmptyStateProps) {
  const locale = useLocale();
  const t = useTranslations('clientDashboard.bookings');

  const isUpcoming = variant === 'upcoming';
  const Icon = isUpcoming ? CalendarX2 : History;

  return (
    <div className="bg-white rounded-xl border border-[#e5d2d7] shadow-sm">
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f2e9eb]">
          <Icon className="h-8 w-8 text-[#915564]" />
        </div>
        <h3 className="text-lg font-bold text-[#1a0f12]">
          {isUpcoming ? t('noUpcoming') : t('noPast')}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-[#915564]">
          {isUpcoming ? t('noUpcomingDescription') : t('noPastDescription')}
        </p>
        {isUpcoming && (
          <Link
            href={`/${locale}/experiences`}
            className="mt-6 inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors"
          >
            <Search className="h-4 w-4" />
            {t('browseExperiences')}
          </Link>
        )}
      </div>
    </div>
  );
}
