import { getLocale, getTranslations } from 'next-intl/server';
import { OccurrenceStatus } from '@prisma/client';
import { CalendarOff, Clock, Users } from 'lucide-react';
import { getUpcomingOccurrences } from '@/server/queries/occurrence.queries';
import { formatDate } from '@/lib/i18n/formatters';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/routing';

interface UpcomingOccurrencesPreviewProps {
  experienceId: string;
}

const STATUS_KEY: Record<OccurrenceStatus, 'open' | 'closed' | 'cancelled'> = {
  [OccurrenceStatus.OPEN]: 'open',
  [OccurrenceStatus.CLOSED]: 'closed',
  [OccurrenceStatus.CANCELLED]: 'cancelled',
};

const STATUS_CLASS: Record<OccurrenceStatus, string> = {
  [OccurrenceStatus.OPEN]: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  [OccurrenceStatus.CLOSED]: 'bg-stone-100 text-slate-600 border-stone-200',
  [OccurrenceStatus.CANCELLED]: 'bg-rose-50 text-rose-800 border-rose-200',
};

/**
 * Live preview of the next occurrences (P-05 / L-131). Server-rendered:
 * the availability builder's mutations revalidate + router.refresh(),
 * which re-renders this list with fresh data.
 */
export async function UpcomingOccurrencesPreview({
  experienceId,
}: UpcomingOccurrencesPreviewProps) {
  const [t, locale, occurrences] = await Promise.all([
    getTranslations('experience.availability.preview'),
    getLocale(),
    getUpcomingOccurrences(experienceId),
  ]);
  const localeTyped = locale as Locale;

  if (occurrences.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center">
        <CalendarOff className="mx-auto mb-2 h-8 w-8 text-stone-400" />
        <p className="text-sm text-slate-600">{t('empty')}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
      {occurrences.map((occurrence) => (
        <li
          key={occurrence.id}
          className={cn(
            'flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
            occurrence.status !== OccurrenceStatus.OPEN && 'bg-stone-50'
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium capitalize text-slate-900">
              {/* Date-only value (UTC midnight) — format in UTC. */}
              {formatDate(occurrence.date, localeTyped, {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
                timeZone: 'UTC',
              })}
            </span>
            <span className="inline-flex items-center gap-1 text-sm text-slate-600">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {occurrence.startTime}
            </span>
            <span className="inline-flex items-center gap-1 text-sm text-slate-600">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {t('capacity', { count: occurrence.capacity })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {occurrence.source === 'PUNCTUAL' && (
              <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs text-slate-500">
                {t('punctualBadge')}
              </span>
            )}
            {occurrence.isDateBlocked && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {t('blockedBadge')}
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                STATUS_CLASS[occurrence.status]
              )}
            >
              {t(`status.${STATUS_KEY[occurrence.status]}`)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
