import { getLocale, getTranslations } from 'next-intl/server';
import { BookingStatus } from '@prisma/client';
import { Mail } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { formatTime } from '@/lib/i18n/formatters';
import { BookingStatusBadge } from '@/components/features/booking/BookingStatusBadge';
import { BookingActionsSheet } from './BookingActionsSheet';
import { cn } from '@/lib/utils';
import type { BookingDTO } from '@/types/event-detail';

interface BookingRowMobileProps {
  booking: BookingDTO;
  canCheckIn: boolean;
  canMarkNoShow: boolean;
}

export async function BookingRowMobile({
  booking,
  canCheckIn,
  canMarkNoShow,
}: BookingRowMobileProps) {
  const t = await getTranslations('Dashboard.eventDetail');
  const locale = (await getLocale()) as Locale;

  const cancelled =
    booking.status === BookingStatus.CANCELLED_BY_CLIENT ||
    booking.status === BookingStatus.CANCELLED_BY_WINERY;

  return (
    <article
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        cancelled && 'bg-muted text-muted-foreground'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-foreground">
            {booking.visitorName}
          </h4>
          <a
            href={`mailto:${booking.visitorEmail}`}
            className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Mail className="h-3 w-3" aria-hidden="true" />
            <span className="truncate">{booking.visitorEmail}</span>
          </a>
        </div>
        <BookingActionsSheet
          bookingId={booking.id}
          bookingLabel={booking.visitorName}
          status={booking.status}
          canCheckIn={canCheckIn}
          canMarkNoShow={canMarkNoShow}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">{t('columns.partySize')}</dt>
          <dd className="text-muted-foreground">
            {t('partySize.inline', { count: booking.guestCount })}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('columns.reference')}</dt>
          <dd className="font-mono text-muted-foreground">
            {booking.reference}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('columns.status')}</dt>
          <dd className="mt-0.5">
            <BookingStatusBadge status={booking.status} labels="attendance" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('columns.checkIn')}</dt>
          <dd className="text-muted-foreground">
            {booking.checkedInAt
              ? t('checkIn.at', {
                  time: formatTime(booking.checkedInAt, locale),
                })
              : t('checkIn.none')}
          </dd>
        </div>
      </dl>
    </article>
  );
}
