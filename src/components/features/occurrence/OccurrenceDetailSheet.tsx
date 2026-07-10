'use client';

import { useEffect, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BookingStatus, OccurrenceStatus } from '@prisma/client';
import { Ban, Clock, Loader2, Lock, LockOpen, Users } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookingActionsMenu } from '@/components/features/event-detail/BookingActionsMenu';
import { BookingActionsSheet } from '@/components/features/event-detail/BookingActionsSheet';
import { CancelSessionButton } from '@/components/features/event-detail/CancelSessionButton';
import { ContactGuestsButton } from '@/components/features/event-detail/ContactGuestsButton';
import { ScanQrButton } from '@/components/features/event-detail/ScanQrButton';
import { TastingSheetSection } from '@/components/features/wine/TastingSheetSection';
import {
  closeOccurrence,
  reopenOccurrence,
  setOccurrenceCapacity,
} from '@/server/actions/occurrence';
import { formatDate } from '@/lib/i18n/formatters';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';
import { dateKeyOf } from '@/lib/business-rules/occurrence-expansion';
import {
  OCCURRENCE_CAPACITY_MAX,
  OCCURRENCE_CAPACITY_MIN,
} from '@/lib/constants/occurrences';
import { timeSlotSchema } from '@/lib/validators/booking';
import { cn } from '@/lib/utils';
import type { ErrorCode } from '@/types/actions';
import type { OccurrenceCalendarEntryDTO } from '@/server/queries/occurrence.queries';
import type { WineDTO } from '@/server/queries/wine.queries';
import type { Locale } from '@/i18n/routing';

/** H-2 → H+2 scan window around the day's sessions (legacy ENC-096 rule). */
const SCAN_WINDOW_MS = 2 * 60 * 60 * 1000;

interface OccurrenceDetailSheetProps {
  entry: OccurrenceCalendarEntryDTO | null;
  /**
   * Every entry of the selected day — the daily H-2/H+2 scan window spans
   * all of them (first start − 2h → last end + 2h), as on the legacy
   * sessions view.
   */
  dayEntries: OccurrenceCalendarEntryDTO[];
  experienceId: string;
  experienceSlug: string;
  experienceTitle: string;
  wineryName: string;
  /** Experience duration in minutes — a session ends at start + duration. */
  durationMinutes: number;
  /** False when the experience is archived — operational actions hidden. */
  canEdit: boolean;
  /** Winery wine catalogue (P-07) — null when TASTING_SHEET is OFF. */
  tastingWines: WineDTO[] | null;
  onOpenChange: (_open: boolean) => void;
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

const ATTENDEE_STATUS_KEY: Partial<Record<BookingStatus, string>> = {
  [BookingStatus.CONFIRMED]: 'confirmed',
  [BookingStatus.COMPLETED]: 'completed',
  [BookingStatus.NO_SHOW]: 'noShow',
  [BookingStatus.CANCELLED_BY_CLIENT]: 'cancelledByClient',
  [BookingStatus.CANCELLED_BY_WINERY]: 'cancelledByWinery',
};

/** Same palette as the legacy per-booking status badge (ENC-096). */
const ATTENDEE_STATUS_CLASS: Partial<Record<BookingStatus, string>> = {
  [BookingStatus.CONFIRMED]: 'bg-emerald-50 text-emerald-800',
  [BookingStatus.COMPLETED]: 'bg-blue-50 text-blue-800',
  [BookingStatus.NO_SHOW]: 'bg-stone-100 text-slate-700',
  [BookingStatus.CANCELLED_BY_CLIENT]: 'bg-rose-50 text-rose-800',
  [BookingStatus.CANCELLED_BY_WINERY]: 'bg-rose-50 text-rose-800',
};

/**
 * UTC instant bounds of an entry's session, or null when the stored
 * startTime is malformed (defensive — mirrors getSessionEndsAt in
 * src/server/actions/event-detail.ts).
 */
function sessionBoundsOf(
  entry: OccurrenceCalendarEntryDTO,
  durationMinutes: number
): { startsAt: Date; endsAt: Date } | null {
  if (!timeSlotSchema.safeParse(entry.startTime).success) return null;
  const startsAt = zonedWallClockToUTC(entry.date, entry.startTime);
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
  };
}

/**
 * Occurrence detail sheet (P-05 / L-132): seat gauge, attendee list with
 * per-booking day-J actions (check-in, no-show, ADR-0001 reverts), the
 * session tools re-homed from the legacy view (scan QR, contact guests,
 * cancel session with refunds) and the three occurrence owner actions —
 * close/reopen, capacity override, reset. Straggler sessions
 * (occurrenceId null, pre-engine bookings) keep the booking-level tools
 * but not the occurrence management block.
 */
export function OccurrenceDetailSheet({
  entry,
  dayEntries,
  experienceId,
  experienceSlug,
  experienceTitle,
  wineryName,
  durationMinutes,
  canEdit,
  tastingWines,
  onOpenChange,
}: OccurrenceDetailSheetProps) {
  const t = useTranslations('Dashboard.eventDetail.occurrences');
  const tBookingStatus = useTranslations('Dashboard.eventDetail.bookingStatus');
  const tPartySize = useTranslations('Dashboard.eventDetail.partySize');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [capacityInput, setCapacityInput] = useState('');
  const [capacityError, setCapacityError] = useState(false);

  const occurrenceId = entry?.occurrenceId ?? null;
  const capacityOverride = entry?.capacityOverride ?? null;

  // Sync the input with the (possibly refreshed) entry.
  useEffect(() => {
    setCapacityInput(capacityOverride === null ? '' : String(capacityOverride));
    setCapacityError(false);
  }, [occurrenceId, capacityOverride]);

  const mapError = (code: ErrorCode): string => {
    switch (code) {
      case 'NOT_FOUND':
        return t('errors.notFound');
      case 'CONFLICT':
        return t('errors.conflict');
      case 'VALIDATION_ERROR':
        return t('errors.validation');
      default:
        return t('errors.generic');
    }
  };

  const handleToggleStatus = () => {
    if (!entry || entry.occurrenceId === null) return;
    const id = entry.occurrenceId;
    const isClosing = entry.status === OccurrenceStatus.OPEN;
    startTransition(async () => {
      const result = isClosing
        ? await closeOccurrence({ occurrenceId: id })
        : await reopenOccurrence({ occurrenceId: id });
      if (!result.success) {
        toast.error(mapError(result.error.code));
        return;
      }
      toast.success(isClosing ? t('toasts.closed') : t('toasts.reopened'));
      router.refresh();
    });
  };

  const applyCapacity = (value: number | null) => {
    if (!entry || entry.occurrenceId === null) return;
    const id = entry.occurrenceId;
    startTransition(async () => {
      const result = await setOccurrenceCapacity({
        occurrenceId: id,
        capacityOverride: value,
      });
      if (!result.success) {
        toast.error(mapError(result.error.code));
        return;
      }
      toast.success(
        value === null
          ? t('toasts.capacityReset')
          : t('toasts.capacityUpdated', { count: value })
      );
      router.refresh();
    });
  };

  const handleApplyCapacity = () => {
    const parsed = Number.parseInt(capacityInput, 10);
    if (
      Number.isNaN(parsed) ||
      parsed < OCCURRENCE_CAPACITY_MIN ||
      parsed > OCCURRENCE_CAPACITY_MAX
    ) {
      setCapacityError(true);
      return;
    }
    setCapacityError(false);
    applyCapacity(parsed);
  };

  const isOpen = entry !== null;
  const isLegacy = entry !== null && entry.occurrenceId === null;
  const isCancelled = entry?.status === OccurrenceStatus.CANCELLED;
  const canAct = entry !== null && !isLegacy && !isCancelled;
  const gaugePercent =
    entry && entry.capacity > 0
      ? Math.min(100, Math.round((entry.bookedCount / entry.capacity) * 100))
      : 0;

  // Day-J runtime (legacy ENC-096 semantics). The sheet only mounts its
  // content after a client-side tap, so reading the clock here is safe.
  const now = Date.now();
  const bounds =
    entry === null ? null : sessionBoundsOf(entry, durationMinutes);
  const isPastSession = bounds !== null && now > bounds.endsAt.getTime();
  // Daily scan window: first start − 2h → last end + 2h across the day's
  // non-cancelled sessions (a cancelled occurrence never extends it).
  let scanActive = false;
  for (const dayEntry of dayEntries) {
    if (dayEntry.status === OccurrenceStatus.CANCELLED) continue;
    const dayBounds = sessionBoundsOf(dayEntry, durationMinutes);
    if (!dayBounds) continue;
    if (
      now >= dayBounds.startsAt.getTime() - SCAN_WINDOW_MS &&
      now <= dayBounds.endsAt.getTime() + SCAN_WINDOW_MS
    ) {
      scanActive = true;
      break;
    }
  }
  const canCheckIn = canEdit && scanActive && !isPastSession;
  const canMarkNoShow =
    canEdit && bounds !== null && bounds.endsAt.getTime() <= now;
  const sessionId =
    entry === null ? '' : `${dateKeyOf(entry.date)}|${entry.startTime}`;
  const confirmedAttendeeCount =
    entry === null
      ? 0
      : entry.attendees.filter(
          (attendee) => attendee.status === BookingStatus.CONFIRMED
        ).length;
  const showSessionTools =
    entry !== null && canEdit && bounds !== null && !isPastSession;
  // Tasting sheet (P-07 / L-061): once the session started, for sessions
  // with at least one active (CONFIRMED/COMPLETED) booking. tastingWines
  // null = flag OFF, the section never exists.
  const activeAttendeeCount =
    entry === null
      ? 0
      : entry.attendees.filter(
          (attendee) =>
            attendee.status === BookingStatus.CONFIRMED ||
            attendee.status === BookingStatus.COMPLETED
        ).length;
  // Loose != null: a JS caller omitting the prop must read as flag OFF.
  const showTastingSheet =
    tastingWines != null &&
    entry !== null &&
    canEdit &&
    bounds !== null &&
    now >= bounds.startsAt.getTime() &&
    activeAttendeeCount > 0;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {entry && (
          <div className="space-y-6">
            <SheetHeader className="space-y-2 text-left">
              <SheetTitle className="capitalize">
                {/* Date-only value (UTC midnight) — format in UTC. */}
                {formatDate(entry.date, locale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  timeZone: 'UTC',
                })}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {entry.startTime}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                    STATUS_CLASS[entry.status]
                  )}
                >
                  {t(`status.${STATUS_KEY[entry.status]}`)}
                </span>
                {entry.isDateBlocked && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    <Ban className="h-3 w-3" aria-hidden="true" />
                    {t('blockedDay')}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>

            {/* Seat gauge */}
            <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {t('sheet.gauge', {
                    booked: entry.bookedCount,
                    capacity: entry.capacity,
                  })}
                </span>
                <span className="text-slate-500">{gaugePercent}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-stone-100"
                role="progressbar"
                aria-valuenow={entry.bookedCount}
                aria-valuemin={0}
                aria-valuemax={entry.capacity}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    gaugePercent >= 100 ? 'bg-amber-500' : 'bg-burgundy-600'
                  )}
                  style={{ width: `${gaugePercent}%` }}
                />
              </div>
              {entry.capacityOverride !== null && (
                <p className="text-xs text-slate-500">
                  {t('sheet.overrideActive', {
                    count: entry.capacityOverride,
                  })}
                </p>
              )}
            </div>

            {/* Legacy note */}
            {isLegacy && (
              <p className="rounded-lg bg-stone-50 p-3 text-sm text-slate-600">
                {t('sheet.legacyNote')}
              </p>
            )}

            {/* Occurrence management */}
            {!isLegacy && (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant={
                    entry.status === OccurrenceStatus.OPEN
                      ? 'outline'
                      : 'default'
                  }
                  onClick={handleToggleStatus}
                  disabled={!canAct || isPending}
                  className="w-full gap-2"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : entry.status === OccurrenceStatus.OPEN ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <LockOpen className="h-4 w-4" />
                  )}
                  {entry.status === OccurrenceStatus.OPEN
                    ? t('sheet.close')
                    : t('sheet.reopen')}
                </Button>
                {isCancelled && (
                  <p className="text-xs text-slate-500">
                    {t('sheet.cancelledNote')}
                  </p>
                )}

                <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
                  <Label
                    htmlFor="occurrence-capacity"
                    className="text-sm font-medium text-slate-900"
                  >
                    {t('sheet.capacityLabel')}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="occurrence-capacity"
                      type="number"
                      min={OCCURRENCE_CAPACITY_MIN}
                      max={OCCURRENCE_CAPACITY_MAX}
                      value={capacityInput}
                      onChange={(event) => {
                        setCapacityInput(event.target.value);
                        setCapacityError(false);
                      }}
                      placeholder={t('sheet.capacityPlaceholder')}
                      disabled={!canAct || isPending}
                      className="h-9 w-24"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApplyCapacity}
                      disabled={!canAct || isPending || capacityInput === ''}
                    >
                      {t('sheet.apply')}
                    </Button>
                    {entry.capacityOverride !== null && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => applyCapacity(null)}
                        disabled={!canAct || isPending}
                      >
                        {t('sheet.reset')}
                      </Button>
                    )}
                  </div>
                  <p
                    className={cn(
                      'text-xs',
                      capacityError ? 'text-red-600' : 'text-slate-500'
                    )}
                  >
                    {capacityError
                      ? t('sheet.capacityInvalid', {
                          min: OCCURRENCE_CAPACITY_MIN,
                          max: OCCURRENCE_CAPACITY_MAX,
                        })
                      : t('sheet.capacityHint')}
                  </p>
                </div>
              </div>
            )}

            {/* Session tools (day-J), re-homed from the legacy view:
                scanner entry point, contact attendees, cancel session
                with refunds. Booking-level — stragglers included. */}
            {showSessionTools && (
              <div className="flex flex-wrap items-center gap-2">
                <ScanQrButton
                  experienceSlug={experienceSlug}
                  sessionId={sessionId}
                  enabled={scanActive}
                />
                <ContactGuestsButton
                  experienceId={experienceId}
                  sessionId={sessionId}
                  attendeeCount={confirmedAttendeeCount}
                  experienceTitle={experienceTitle}
                  wineryName={wineryName}
                  startsAtIso={bounds.startsAt.toISOString()}
                />
                <CancelSessionButton
                  experienceId={experienceId}
                  sessionId={sessionId}
                />
              </div>
            )}

            {/* Tasting sheet (P-07 / L-061) */}
            {showTastingSheet && tastingWines != null && (
              <TastingSheetSection
                experienceId={experienceId}
                dateKey={dateKeyOf(entry.date)}
                timeSlot={entry.startTime}
                wines={tastingWines}
                servedWineIds={entry.servedWineIds ?? []}
                activeAttendeeCount={activeAttendeeCount}
              />
            )}

            {/* Attendees */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-900">
                {t('sheet.attendees', { count: entry.attendees.length })}
              </h3>
              {entry.attendees.length === 0 ? (
                <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm text-slate-500">
                  {t('sheet.noAttendees')}
                </p>
              ) : (
                <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
                  {entry.attendees.map((attendee) => {
                    const statusKey = ATTENDEE_STATUS_KEY[attendee.status];
                    const isCancelledBooking =
                      attendee.status === BookingStatus.CANCELLED_BY_CLIENT ||
                      attendee.status === BookingStatus.CANCELLED_BY_WINERY;
                    return (
                      <li
                        key={attendee.bookingId}
                        className={cn(
                          'flex items-center justify-between gap-3 px-4 py-3',
                          isCancelledBooking && 'bg-stone-50/60'
                        )}
                      >
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'truncate text-sm font-medium text-slate-900',
                              isCancelledBooking &&
                                'text-slate-400 line-through'
                            )}
                          >
                            {attendee.visitorName}
                          </p>
                          <p
                            className={cn(
                              'text-xs text-slate-500',
                              isCancelledBooking && 'text-slate-400'
                            )}
                          >
                            {tPartySize('inline', {
                              count: attendee.guestCount,
                            })}
                            {' · '}
                            <span className="font-mono">
                              {attendee.reference}
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {statusKey !== undefined && (
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium',
                                ATTENDEE_STATUS_CLASS[attendee.status] ??
                                  'bg-stone-100 text-slate-600'
                              )}
                            >
                              {tBookingStatus(statusKey)}
                            </span>
                          )}
                          {/* Per-booking actions: check-in / no-show and
                              the ADR-0001 reverts. Both variants no-op on
                              cancelled bookings (they render null). */}
                          <div className="hidden md:block">
                            <BookingActionsMenu
                              bookingId={attendee.bookingId}
                              status={attendee.status}
                              canCheckIn={canCheckIn}
                              canMarkNoShow={canMarkNoShow}
                            />
                          </div>
                          <div className="md:hidden">
                            <BookingActionsSheet
                              bookingId={attendee.bookingId}
                              bookingLabel={attendee.visitorName}
                              status={attendee.status}
                              canCheckIn={canCheckIn}
                              canMarkNoShow={canMarkNoShow}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
