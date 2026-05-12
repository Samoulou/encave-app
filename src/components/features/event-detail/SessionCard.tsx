import { getLocale, getTranslations } from 'next-intl/server';
import { Clock, Users } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { formatDate } from '@/lib/i18n/formatters';
import { BookingsTable } from './BookingsTable';
import { ScanQrButton } from './ScanQrButton';
import { SessionBadges } from './SessionBadges';
import type { EventSessionDTO } from '@/types/event-detail';

interface SessionCardProps {
  session: EventSessionDTO;
  experienceSlug: string;
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
  experienceSlug,
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
  // Mark-no-show allowed once session has ended (or during scan window for
  // operational fix), and not in the past beyond reach. Spec asks: disabled
  // until end of session. We allow once startsAt has passed.
  const canMarkNoShow = canEdit && session.startsAt.getTime() <= Date.now();

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
          <ScanQrButton
            experienceSlug={experienceSlug}
            sessionId={session.sessionId}
            enabled={isScanWindow}
          />
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
