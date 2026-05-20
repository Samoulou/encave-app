import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/server/auth';
import {
  getClientUpcomingBookings,
  getClientPastBookings,
  type ClientBookingWithDetails,
} from '@/server/queries/client-booking.queries';
import { ClientBookingCard } from './ClientBookingCard';
import { ClientBookingEmptyState } from './ClientBookingEmptyState';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { Link } from '@/i18n/navigation';
import { Calendar, Clock, Heart, Sparkles, Wine } from 'lucide-react';
import { formatCHF } from '@/lib/utils/currency';

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
  const featured = upcoming[0];
  const otherUpcoming = upcoming.slice(1);

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

      <div className="flex gap-2 rounded-[16px] border border-stone-200 bg-white p-1.5 shadow-audit-card">
        {[
          ['À venir', upcoming.length, true],
          ['Passées', past.length, false],
          ['Brouillons', 0, false],
          ['Favoris', 0, false],
        ].map(([label, count, selected]) => (
          <button
            key={label as string}
            type="button"
            className={`h-10 rounded-xl px-5 text-sm font-semibold ${
              selected
                ? 'bg-ink-900 text-white'
                : 'text-ink-500 hover:bg-cream-100'
            }`}
          >
            {label as string}{' '}
            <span className="font-mono opacity-70">{count as number}</span>
          </button>
        ))}
      </div>

      {featured ? (
        <FeaturedBooking booking={featured} />
      ) : (
        <ClientBookingEmptyState variant="upcoming" />
      )}

      {otherUpcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Autres réservations à venir
          </h2>
          {otherUpcoming.map((booking) => (
            <CompactBookingRow key={booking.id} booking={booking} />
          ))}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="mb-4 font-display text-xl font-semibold text-ink-900">
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
        </div>

        <aside className="rounded-[18px] border border-stone-200 bg-white p-5 shadow-audit-card">
          <div className="flex items-center gap-2 font-display text-xl font-semibold">
            <Sparkles className="h-5 w-5 text-burgundy-700" />
            Recommandations
          </div>
          <p className="mt-2 text-sm text-ink-500">
            Basé sur vos réservations et les expériences populaires en Valais.
          </p>
          <div className="mt-5 space-y-3">
            {[
              ['Dégustation privée', 'Domaines vérifiés'],
              ['Visite de cave', 'Idéal en groupe'],
              ['Accords locaux', 'Weekend'],
            ].map(([title, meta]) => (
              <Link
                key={title}
                href="/experiences"
                className="flex items-center gap-3 rounded-xl border border-stone-200 p-3 transition-colors hover:bg-cream-100"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-burgundy-50 text-burgundy-700">
                  <Wine className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink-900">
                    {title}
                  </span>
                  <span className="block text-xs text-ink-500">{meta}</span>
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function formatBookingDate(date: Date) {
  return new Intl.DateTimeFormat('fr-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function FeaturedBooking({ booking }: { booking: ClientBookingWithDetails }) {
  return (
    <section className="grid overflow-hidden rounded-[22px] border border-stone-200 bg-white shadow-audit-elevated lg:grid-cols-[1.25fr_.9fr]">
      <div className="relative min-h-[280px]">
        <ImageWithFallback
          src={booking.experience.coverPhoto}
          alt={booking.experience.title}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 60vw"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <span className="bg-white/18 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] backdrop-blur-md">
            Prochaine visite
          </span>
          <h2 className="mt-3 max-w-xl font-display text-4xl font-semibold leading-tight">
            {booking.experience.title}
          </h2>
          <p className="mt-2 text-white/80">{booking.winery.name}</p>
        </div>
      </div>
      <div className="flex flex-col justify-between p-6">
        <div className="space-y-4">
          <InfoLine
            icon={<Calendar className="h-4 w-4" />}
            label={formatBookingDate(new Date(booking.date))}
          />
          <InfoLine
            icon={<Clock className="h-4 w-4" />}
            label={`${booking.timeSlot} · ${booking.experience.duration} min`}
          />
          <InfoLine
            icon={<Heart className="h-4 w-4" />}
            label={`${booking.guestCount} personnes · ${formatCHF(booking.totalPrice)}`}
          />
        </div>
        <div className="mt-8 flex gap-3">
          <Link
            href={`/experiences/${booking.experience.slug}`}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-ink-900 text-sm font-bold text-white"
          >
            Voir le détail
          </Link>
          <span className="inline-flex h-11 items-center rounded-xl border border-stone-200 px-4 font-mono text-xs text-ink-500">
            {booking.reference}
          </span>
        </div>
      </div>
    </section>
  );
}

function CompactBookingRow({ booking }: { booking: ClientBookingWithDetails }) {
  return (
    <Link
      href={`/experiences/${booking.experience.slug}`}
      className="grid items-center gap-4 rounded-[16px] border border-stone-200 bg-white p-4 shadow-audit-card transition-colors hover:bg-cream-100 lg:grid-cols-[72px_1fr_auto]"
    >
      <div className="relative h-16 overflow-hidden rounded-xl">
        <ImageWithFallback
          src={booking.experience.coverPhoto}
          alt={booking.experience.title}
          fill
          className="object-cover"
          sizes="72px"
          unoptimized
        />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold text-ink-900">
          {booking.experience.title}
        </h3>
        <p className="text-sm text-ink-500">
          {booking.winery.name} · {formatBookingDate(new Date(booking.date))} ·{' '}
          {booking.timeSlot}
        </p>
      </div>
      <span className="font-mono text-sm font-bold text-burgundy-700">
        {formatCHF(booking.totalPrice)}
      </span>
    </Link>
  );
}

function InfoLine({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="text-ink-800 flex items-center gap-3 rounded-xl bg-cream-100 px-4 py-3 text-sm font-semibold">
      <span className="text-burgundy-700">{icon}</span>
      {label}
    </div>
  );
}
