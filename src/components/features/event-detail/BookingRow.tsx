import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import { BookingStatus } from '@prisma/client';
import { Mail } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { formatTime } from '@/lib/i18n/formatters';
import { BookingStatusBadge } from './BookingStatusBadge';
import { BookingActionsMenu } from './BookingActionsMenu';
import { cn } from '@/lib/utils';
import type { BookingDTO } from '@/types/event-detail';

interface BookingRowProps {
  booking: BookingDTO;
  canCheckIn: boolean;
  canMarkNoShow: boolean;
}

export async function BookingRow({
  booking,
  canCheckIn,
  canMarkNoShow,
}: BookingRowProps) {
  const t = await getTranslations('Dashboard.eventDetail');
  const locale = (await getLocale()) as Locale;

  const cancelled =
    booking.status === BookingStatus.CANCELLED_BY_CLIENT ||
    booking.status === BookingStatus.CANCELLED_BY_WINERY;

  return (
    <tr
      className={cn(
        'border-b border-slate-100 transition-colors hover:bg-slate-50/60',
        cancelled && 'bg-slate-50/50 text-slate-500'
      )}
    >
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900">
            {booking.visitorName}
          </span>
          <a
            href={`mailto:${booking.visitorEmail}`}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <Mail className="h-3 w-3" aria-hidden="true" />
            <span className="truncate">{booking.visitorEmail}</span>
          </a>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        {t('partySize.inline', { count: booking.guestCount })}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-600">
        {booking.reference}
      </td>
      <td className="px-4 py-3">
        <BookingStatusBadge status={booking.status} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {booking.checkedInAt
          ? t('checkIn.at', { time: formatTime(booking.checkedInAt, locale) })
          : t('checkIn.none')}
      </td>
      <td className="px-2 py-3 text-right">
        <BookingActionsMenu
          bookingId={booking.id}
          status={booking.status}
          canCheckIn={canCheckIn}
          canMarkNoShow={canMarkNoShow}
        />
      </td>
    </tr>
  );
}
