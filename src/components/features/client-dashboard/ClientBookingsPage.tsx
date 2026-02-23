import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import {
  getClientUpcomingBookings,
  getClientPastBookings,
} from '@/server/queries/client-booking.queries';
import { ClientBookingCard } from './ClientBookingCard';
import { ClientBookingEmptyState } from './ClientBookingEmptyState';

export async function ClientBookingsPage() {
  const [session, locale, t] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations('clientDashboard.bookings'),
  ]);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const [upcoming, past] = await Promise.all([
    getClientUpcomingBookings(session.user.email),
    getClientPastBookings(session.user.email),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
        {t('title')}
      </h1>

      {/* Upcoming Bookings */}
      <section>
        <h2 className="font-display text-lg font-bold text-foreground mb-4">
          {t('upcoming')} ({upcoming.length})
        </h2>
        {upcoming.length > 0 ? (
          <div className="space-y-4">
            {upcoming.map((booking) => (
              <ClientBookingCard
                key={booking.id}
                booking={booking}
                variant="upcoming"
              />
            ))}
          </div>
        ) : (
          <ClientBookingEmptyState variant="upcoming" />
        )}
      </section>

      {/* Past Bookings */}
      <section>
        <h2 className="font-display text-lg font-bold text-foreground mb-4">
          {t('past')} ({past.length})
        </h2>
        {past.length > 0 ? (
          <div className="space-y-4">
            {past.map((booking) => (
              <ClientBookingCard
                key={booking.id}
                booking={booking}
                variant="past"
              />
            ))}
          </div>
        ) : (
          <ClientBookingEmptyState variant="past" />
        )}
      </section>
    </div>
  );
}
