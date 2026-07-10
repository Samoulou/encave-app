'use client';

import { useEffect, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { GlassWater, Loader2, Send } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { saveTastingSheet } from '@/server/actions/tasting-sheet';
import { formatDate } from '@/lib/i18n/formatters';
import type { WineDTO } from '@/server/queries/wine.queries';
import type { Locale } from '@/i18n/routing';

interface TastingSheetSectionProps {
  experienceId: string;
  /** "YYYY-MM-DD" of the session (Zurich calendar day). */
  dateKey: string;
  timeSlot: string;
  /** Winery catalogue — served-but-now-unavailable wines stay listed. */
  wines: WineDTO[];
  /** Wines already persisted on the session's bookings. */
  servedWineIds: string[];
  /** Active (CONFIRMED/COMPLETED) bookings of the session. */
  activeAttendeeCount: number;
}

/**
 * Per-session tasting sheet (P-07 / L-061, decision D1): full-width
 * ≥48px toggle rows — fillable in under 30s on a phone — and one
 * « Envoyer le récap » button that persists the fan-out and arms the
 * J+2 recap for every active booking.
 */
export function TastingSheetSection({
  experienceId,
  dateKey,
  timeSlot,
  wines,
  servedWineIds,
  activeAttendeeCount,
}: TastingSheetSectionProps) {
  const t = useTranslations('Dashboard.tastingSheet');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(servedWineIds)
  );
  const [armedRunAt, setArmedRunAt] = useState<Date | null>(null);

  // Re-sync when the sheet is reopened on another session.
  useEffect(() => {
    setChecked(new Set(servedWineIds));
    setArmedRunAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceId, dateKey, timeSlot, servedWineIds.join(',')]);

  const hasSheet = servedWineIds.length > 0;
  const isDirty =
    checked.size !== servedWineIds.length ||
    servedWineIds.some((id) => !checked.has(id));
  // Sending 0 wines is only meaningful to clear an existing sheet.
  const canSubmit = !isPending && isDirty && (checked.size > 0 || hasSheet);

  const toggle = (wineId: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(wineId)) {
        next.delete(wineId);
      } else {
        next.add(wineId);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await saveTastingSheet({
        experienceId,
        date: dateKey,
        timeSlot,
        wineIds: Array.from(checked),
      });
      if (!result.success) {
        toast.error(t('saveFailed'));
        return;
      }
      if (result.data.recapRunAt !== null) {
        setArmedRunAt(new Date(result.data.recapRunAt));
        toast.success(t('armed', { count: result.data.bookingCount }));
      } else {
        setArmedRunAt(null);
        toast.success(t('cleared'));
      }
      router.refresh();
    });
  };

  if (wines.length === 0) {
    return (
      <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="inline-flex items-center gap-1.5 font-medium text-slate-900">
          <GlassWater className="h-4 w-4" aria-hidden="true" />
          {t('title')}
        </h3>
        <p className="text-sm text-slate-500">{t('noWines')}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/wines">{t('manageWines')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <div>
        <h3 className="inline-flex items-center gap-1.5 font-medium text-slate-900">
          <GlassWater className="h-4 w-4" aria-hidden="true" />
          {t('title')}
        </h3>
        <p className="text-xs text-slate-500">{t('subtitle')}</p>
      </div>

      <ul className="divide-y divide-stone-100">
        {wines.map((wine) => {
          const isChecked = checked.has(wine.id);
          return (
            <li key={wine.id}>
              {/* Whole row tappable — ≥48px touch target (DoD L-061). */}
              <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 py-1">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {wine.name}
                    {wine.vintage != null && (
                      <span className="ml-1.5 font-normal text-slate-500">
                        {wine.vintage}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {wine.grapeVariety}
                  </span>
                </span>
                <Switch
                  checked={isChecked}
                  disabled={isPending}
                  onCheckedChange={() => toggle(wine.id)}
                  aria-label={t('toggleWine', { name: wine.name })}
                />
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {t('checkedCount', { count: checked.size })}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="gap-1.5"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {checked.size === 0 && hasSheet ? t('clearButton') : t('sendButton')}
        </Button>
      </div>

      {armedRunAt !== null && (
        <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
          {t('armedNote', {
            count: activeAttendeeCount,
            date: formatDate(armedRunAt, locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }),
          })}
        </p>
      )}
      {armedRunAt === null && hasSheet && !isDirty && (
        <p className="rounded-lg bg-stone-50 p-3 text-xs text-slate-600">
          {t('alreadyFilled')}
        </p>
      )}
    </div>
  );
}
