import { getLocale, getTranslations } from 'next-intl/server';
import { Clock, Users } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { formatDate } from '@/lib/i18n/formatters';
import { BookingsTable } from './BookingsTable';
import { ScanQrButton } from './ScanQrButton';
import { CancelSessionButton } from './CancelSessionButton';
import { ContactGuestsButton } from './ContactGuestsButton';
import { SessionBadges } from './SessionBadges';
import type { EventSessionDTO } from '@/types/event-detail';
import { BookingStatus } from '@prisma/client';

interface SessionCardProps {
  session: EventSessionDTO;
  experienceId: string;
  experienceSlug: string;
  experienceTitle: string;
  wineryName: string;
  /** True when `now` falls inside [startsAt, endsAt]. */
  isLive: boolean;
  /** True when `now` falls inside the H-2 / H+2 daily scan window. */
  isScanWindow: boolean;
  /** True when the session is in the past. */
  isPast: boolean;
  /** Whether the experience can still receive operational actions. */
  canEdit: boolean;
}

export async function SessionCard({
  session,
  experienceId,
  experienceSlug,
  experienceTitle,
  wineryName,
  isLive,
  isScanWindow,
  isPast,
  canEdit,
}: SessionCardProps) {
  const t = await getTranslations('Dashboard.eventDetail');
  const locale = (await getLocale()) as Locale;

  const dateLabel = formatDate(session.startsAt, locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // CheckIn allowed while the live window is active and edits are allowed.
  const canCheckIn = canEdit && isScanWindow && !isPast;
  // Mark-no-show: spec says "disabled until the end of the session". The
  // server action also enforces this (defense in depth).
  const canMarkNoShow = canEdit && session.endsAt.getTime() <= Date.now();
  const attendeeCount = new Set(
    session.bookings
      .filter((booking) => booking.status === BookingStatus.CONFIRMED)
      .map((booking) => booking.visitorEmail.trim().toLowerCase())
  ).size;

  return (
    <section
      aria-labelledby={`session-${session.sessionId}-title`}
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id={`session-${session.sessionId}-title`}
              className="text-base font-semibold capitalize text-slate-900"
            >
              {dateLabel}
            </h3>
            <SessionBadges isLive={isLive} isFull={session.isFull} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {session.timeSlot}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {t('session.capacity', {
                confirmed: session.confirmedSeats,
                total: session.totalCapacity,
              })}
            </span>
          </div>
        </div>

        {canEdit && !isPast ? (
          <div className="flex flex-wrap items-center gap-2">
            <ContactGuestsButton
              experienceId={experienceId}
              sessionId={session.sessionId}
              attendeeCount={attendeeCount}
              experienceTitle={experienceTitle}
              wineryName={wineryName}
              startsAtIso={session.startsAt.toISOString()}
            />
            <CancelSessionButton
              experienceId={experienceId}
              sessionId={session.sessionId}
            />
            <ScanQrButton
              experienceSlug={experienceSlug}
              sessionId={session.sessionId}
              enabled={isScanWindow}
            />
          </div>
        ) : null}
      </header>

      <div className="px-2 py-2 md:px-4 md:py-4">
        <BookingsTable
          bookings={session.bookings}
          canCheckIn={canCheckIn}
          canMarkNoShow={canMarkNoShow}
        />
      </div>
    </section>
  );
}
