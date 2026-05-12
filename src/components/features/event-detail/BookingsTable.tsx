import { getTranslations } from 'next-intl/server';
import { BookingRow } from './BookingRow';
import { BookingRowMobile } from './BookingRowMobile';
import type { BookingDTO } from '@/types/event-detail';

interface BookingsTableProps {
  bookings: BookingDTO[];
  canCheckIn: boolean;
  canMarkNoShow: boolean;
}

export async function BookingsTable({
  bookings,
  canCheckIn,
  canMarkNoShow,
}: BookingsTableProps) {
  const t = await getTranslations('Dashboard.eventDetail');

  if (bookings.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-slate-500">
        {t('session.empty')}
      </p>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">{t('columns.client')}</th>
              <th className="px-4 py-2">{t('columns.partySize')}</th>
              <th className="px-4 py-2">{t('columns.reference')}</th>
              <th className="px-4 py-2">{t('columns.status')}</th>
              <th className="px-4 py-2">{t('columns.checkIn')}</th>
              <th className="px-2 py-2 text-right">
                <span className="sr-only">{t('columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                canCheckIn={canCheckIn}
                canMarkNoShow={canMarkNoShow}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {bookings.map((booking) => (
          <BookingRowMobile
            key={booking.id}
            booking={booking}
            canCheckIn={canCheckIn}
            canMarkNoShow={canMarkNoShow}
          />
        ))}
      </div>
    </>
  );
}
