'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CalendarPlus, Loader2, Plus, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { addPunctualOccurrences } from '@/server/actions/occurrence';
import { TIME_SLOTS } from '@/lib/constants/time-slots';
import { localDateKey } from '@/lib/utils/date-key';
import { formatDate } from '@/lib/i18n/formatters';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/routing';

/** Server-side cap of addPunctualOccurrencesSchema (picks max 60). */
const MAX_PICKS = 60;

interface PunctualOccurrencePickerProps {
  experienceId: string;
}

interface Pick {
  key: string;
  date: Date;
  dateKey: string;
  startTime: string;
}

function buildPicks(
  dates: Date[],
  times: string[],
  removedKeys: ReadonlySet<string>
): Pick[] {
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const sortedTimes = [...times].sort((a, b) => a.localeCompare(b));
  const picks: Pick[] = [];
  for (const date of sortedDates) {
    const dateKey = localDateKey(date);
    for (const startTime of sortedTimes) {
      const key = `${dateKey}|${startTime}`;
      if (!removedKeys.has(key)) {
        picks.push({ key, date, dateKey, startTime });
      }
    }
  }
  return picks;
}

/**
 * Punctual occurrences builder (P-05 / L-131): pick future dates on the
 * calendar + start times as chips; the (date × time) combinations show
 * as removable chips and are created via `addPunctualOccurrences`.
 */
export function PunctualOccurrencePicker({
  experienceId,
}: PunctualOccurrencePickerProps) {
  const t = useTranslations('experience.availability.punctual');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [removedKeys, setRemovedKeys] = useState<ReadonlySet<string>>(
    new Set()
  );

  const picks = buildPicks(selectedDates, selectedTimes, removedKeys);
  const tooMany = picks.length > MAX_PICKS;

  const handleDatesChange = (next: Date[] | undefined) => {
    const nextDates = next ?? [];
    // Re-adding a date must resurrect combos removed while it was gone.
    const previousKeys = new Set(selectedDates.map(localDateKey));
    const addedDateKeys = nextDates
      .map(localDateKey)
      .filter((key) => !previousKeys.has(key));
    if (addedDateKeys.length > 0) {
      setRemovedKeys(
        (prev) =>
          new Set(
            Array.from(prev).filter((key) => {
              const dateKey = key.split('|')[0];
              return dateKey === undefined || !addedDateKeys.includes(dateKey);
            })
          )
      );
    }
    setSelectedDates(nextDates);
  };

  const handleTimeToggle = (time: string) => {
    if (selectedTimes.includes(time)) {
      setSelectedTimes(selectedTimes.filter((slot) => slot !== time));
      return;
    }
    // Re-adding a time resurrects combos removed while it was gone.
    setRemovedKeys(
      (prev) =>
        new Set(Array.from(prev).filter((key) => !key.endsWith(`|${time}`)))
    );
    setSelectedTimes([...selectedTimes, time]);
  };

  const handleRemovePick = (key: string) => {
    setRemovedKeys((prev) => new Set(prev).add(key));
  };

  const handleSubmit = () => {
    if (picks.length === 0 || tooMany) return;
    startTransition(async () => {
      const result = await addPunctualOccurrences({
        experienceId,
        picks: picks.map((pick) => ({
          date: pick.dateKey,
          startTime: pick.startTime,
        })),
      });
      if (!result.success) {
        toast.error(t(`errors.${errorKeyOf(result.error.code)}`));
        return;
      }
      toast.success(t('added', { count: result.data.created }));
      setSelectedDates([]);
      setSelectedTimes([]);
      setRemovedKeys(new Set());
      // Re-render the server-side "next 8 occurrences" preview.
      router.refresh();
    });
  };

  const formatPickLabel = (pick: Pick) =>
    `${formatDate(pick.date, locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })} · ${pick.startTime}`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">{t('description')}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Date selection */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h4 className="mb-3 font-medium text-slate-900">
            {t('selectDates')}
          </h4>
          <Calendar
            mode="multiple"
            selected={selectedDates}
            onSelect={handleDatesChange}
            disabled={{ before: new Date() }}
          />
        </div>

        {/* Time chips */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h4 className="mb-3 font-medium text-slate-900">
            {t('selectTimes')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {TIME_SLOTS.map((time) => {
              const isSelected = selectedTimes.includes(time);
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => handleTimeToggle(time)}
                  aria-pressed={isSelected}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    isSelected
                      ? 'border-burgundy-600 bg-burgundy-600 text-white'
                      : 'border-stone-200 bg-white text-slate-700 hover:border-burgundy-300'
                  )}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Picks list */}
      {picks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center">
          <CalendarPlus className="mx-auto mb-2 h-8 w-8 text-stone-400" />
          <p className="text-sm text-slate-600">{t('noPicks')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900">
            {t('picksTitle', { count: picks.length })}
          </h4>
          <div className="flex flex-wrap gap-2">
            {picks.map((pick) => {
              const label = formatPickLabel(pick);
              return (
                <span
                  key={pick.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-burgundy-200 bg-burgundy-50 py-1 pl-3 pr-1.5 text-sm text-burgundy-800"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => handleRemovePick(pick.key)}
                    className="rounded-full p-0.5 text-burgundy-500 transition-colors hover:bg-burgundy-100 hover:text-burgundy-800"
                    aria-label={t('removePick', { pick: label })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
          {tooMany && (
            <p className="text-sm text-red-600">
              {t('tooMany', { max: MAX_PICKS })}
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end border-t border-stone-200 pt-6">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || picks.length === 0 || tooMany}
          className="gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              {t('submit')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** Map ActionResult error codes to the punctual error i18n keys. */
function errorKeyOf(code: string): 'notFound' | 'validation' | 'generic' {
  switch (code) {
    case 'NOT_FOUND':
      return 'notFound';
    case 'VALIDATION_ERROR':
      return 'validation';
    default:
      return 'generic';
  }
}
