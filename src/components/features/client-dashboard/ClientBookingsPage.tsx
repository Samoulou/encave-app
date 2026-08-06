import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import {
  getClientUpcomingBookings,
  getClientPastBookings,
} from '@/server/queries/client-booking.queries';
import { ClientBookingsTabs } from './ClientBookingsTabs';
import { Link } from '@/i18n/navigation';

interface ClientBookingsPageProps {
  tab?: 'upcoming' | 'past';
}

export async function ClientBookingsPage({
  tab = 'upcoming',
}: ClientBookingsPageProps) {
  const [session, locale, t] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations('clientDashboard.bookings'),
  ]);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Guest bookings are attached by email alone — never expose them to an
  // account whose email is unverified (it would leak another guest's PII).
  if (!session.user.emailVerified) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        {t('verifyEmailBanner')}
      </div>
    );
  }

  const [upcoming, past] = await Promise.all([
    getClientUpcomingBookings(session.user.email),
    getClientPastBookings(session.user.email),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
            Compte client
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.02em] text-ink-900">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Gérez vos prochaines visites, retrouvez l’historique et repartez en
            un clic.
          </p>
        </div>
        <Link
          href="/experiences"
          className="hidden h-11 items-center rounded-full bg-burgundy-600 px-5 text-sm font-bold text-white lg:inline-flex"
        >
          Découvrir
        </Link>
      </div>

      <ClientBookingsTabs upcoming={upcoming} past={past} initialTab={tab} />
    </div>
  );
}
