'use client';

import { useState, useTransition } from 'react';
import { useQueryState } from 'nuqs';
import { useLocale, useTranslations } from 'next-intl';
import { OccurrenceStatus } from '@prisma/client';
import { Ban, CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { OccurrenceDetailSheet } from './OccurrenceDetailSheet';
import { formatDate } from '@/lib/i18n/formatters';
import { localDateKey, shiftMonthKey } from '@/lib/utils/date-key';
import { dateKeyOf } from '@/lib/business-rules/occurrence-expansion';
import { cn } from '@/lib/utils';
import type { OccurrenceCalendarEntryDTO } from '@/server/queries/occurrence.queries';
import type { Locale } from '@/i18n/routing';

interface OccurrenceCalendarProps {
  experienceId: string;
  /** Server-resolved "YYYY-MM" month being displayed. */
  monthKey: string;
  entries: OccurrenceCalendarEntryDTO[];
}

/** Stable key of a calendar entry — occurrence-backed or straggler. */
function entryKey(entry: OccurrenceCalendarEntryDTO): string {
  return `${dateKeyOf(entry.date)}|${entry.startTime}`;
}

function pillClass(entry: OccurrenceCalendarEntryDTO): string {
  if (entry.status === OccurrenceStatus.CANCELLED) {
    return 'border-rose-200 bg-rose-50 text-rose-700 line-through';
  }
  if (entry.status === OccurrenceStatus.CLOSED) {
    return 'border-stone-200 bg-stone-100 text-slate-500';
  }
  if (entry.bookedCount >= entry.capacity) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-800';
}

/**
 * Monthly occurrence calendar for the winery owner (P-05 / L-132).
 * Month navigation via `?mois=YYYY-MM` (nuqs, non-shallow → the server
 * page re-fetches the month). Tapping an occurrence opens the detail
 * sheet (gauge, attendees, close/reopen, capacity override).
 */
export function OccurrenceCalendar({
  experienceId,
  monthKey,
  entries,
}: OccurrenceCalendarProps) {
  const t = useTranslations('Dashboard.eventDetail.occurrences');
  const tDays = useTranslations('common.days.short');
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [, setMonthParam] = useQueryState('mois', {
    shallow: false,
    startTransition,
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr ?? '1970');
  const month = Number(monthStr ?? '01'); // 1-based

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Monday-first grid: number of leading blanks before day 1.
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7;

  const entriesByDay = new Map<number, OccurrenceCalendarEntryDTO[]>();
  for (const entry of entries) {
    const day = entry.date.getUTCDate();
    const dayEntries = entriesByDay.get(day) ?? [];
    dayEntries.push(entry);
    entriesByDay.set(day, dayEntries);
  }

  // Occurrence dates are Zurich calendar days stored at UTC midnight;
  // the viewer's local calendar day is the right "today" to highlight.
  const todayKey = localDateKey(new Date());
  const monthLabel = formatDate(firstOfMonth, locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const selectedEntry =
    selectedKey === null
      ? null
      : (entries.find((entry) => entryKey(entry) === selectedKey) ?? null);

  const weekdayOrder = ['1', '2', '3', '4', '5', '6', '0'] as const;

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setMonthParam(shiftMonthKey(monthKey, -1))}
          disabled={isPending}
          aria-label={t('previousMonth')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2
          className="font-display text-lg font-semibold capitalize text-slate-900"
          aria-live="polite"
        >
          {monthLabel}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setMonthParam(shiftMonthKey(monthKey, 1))}
          disabled={isPending}
          aria-label={t('nextMonth')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title={t('empty.title')}
            description={t('empty.description')}
          />
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href={`/dashboard/experiences/${experienceId}/edit`}>
                {t('empty.cta')}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Month grid */}
          <div
            className={cn(
              'grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 transition-opacity',
              isPending && 'pointer-events-none opacity-60'
            )}
          >
            {weekdayOrder.map((day) => (
              <div
                key={day}
                className="bg-stone-50 py-2 text-center text-xs font-medium text-slate-500"
              >
                {tDays(day)}
              </div>
            ))}

            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div
                key={`blank-${index}`}
                className="min-h-[72px] bg-stone-50"
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const dayEntries = entriesByDay.get(day) ?? [];
              const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
              const isToday = dayKey === todayKey;
              const isBlocked = dayEntries.some((entry) => entry.isDateBlocked);

              return (
                <div
                  key={dayKey}
                  className={cn(
                    'min-h-[72px] space-y-1 bg-white p-1 sm:min-h-[96px] sm:p-1.5',
                    isBlocked && 'bg-red-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs sm:text-sm',
                        isToday
                          ? 'bg-burgundy-600 font-semibold text-white'
                          : 'font-medium text-slate-700'
                      )}
                    >
                      {day}
                    </span>
                    {isBlocked && (
                      <Ban
                        className="h-3.5 w-3.5 text-red-500"
                        aria-label={t('blockedDay')}
                      />
                    )}
                  </div>

                  {dayEntries.map((entry) => {
                    const key = entryKey(entry);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={cn(
                          'block w-full truncate rounded border px-1 py-0.5 text-left text-[10px] font-medium transition-colors hover:opacity-80 sm:px-1.5 sm:text-xs',
                          pillClass(entry),
                          entry.occurrenceId === null && 'border-dashed'
                        )}
                      >
                        {entry.startTime} · {entry.bookedCount}/{entry.capacity}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-emerald-200 bg-emerald-50" />
              {t('legend.open')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-amber-200 bg-amber-50" />
              {t('legend.full')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-stone-200 bg-stone-100" />
              {t('legend.closed')}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarOff className="h-3 w-3 text-red-500" />
              {t('legend.blocked')}
            </span>
          </div>
        </>
      )}

      <OccurrenceDetailSheet
        entry={selectedEntry}
        onOpenChange={(open) => {
          if (!open) setSelectedKey(null);
        }}
      />
    </div>
  );
}
