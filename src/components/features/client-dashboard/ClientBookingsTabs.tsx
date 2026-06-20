'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Clock, Heart, Sparkles, Wine } from 'lucide-react';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { formatCHF } from '@/lib/utils/currency';
import type { ClientBookingWithDetails } from '@/server/queries/client-booking.queries';
import { ClientBookingCard } from './ClientBookingCard';
import { ClientBookingEmptyState } from './ClientBookingEmptyState';

interface ClientBookingsTabsProps {
  upcoming: ClientBookingWithDetails[];
  past: ClientBookingWithDetails[];
}

type ActiveTab = 'upcoming' | 'past';

export function ClientBookingsTabs({
  upcoming,
  past,
}: ClientBookingsTabsProps) {
  const t = useTranslations('clientDashboard.bookings');
  const [activeTab, setActiveTab] = useState<ActiveTab>('upcoming');
  const featured = upcoming[0];
  const otherUpcoming = upcoming.slice(1);

  const tabs = useMemo(
    () => [
      { id: 'upcoming' as const, label: t('upcoming'), count: upcoming.length },
      { id: 'past' as const, label: t('past'), count: past.length },
    ],
    [past.length, t, upcoming.length]
  );

  return (
    <>
      <div
        className="flex gap-2 rounded-[16px] border border-stone-200 bg-white p-1.5 shadow-audit-card"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'h-10 rounded-xl px-5 text-sm font-semibold transition-colors',
              activeTab === tab.id
                ? 'bg-ink-900 text-white'
                : 'text-ink-500 hover:bg-cream-100'
            )}
          >
            {tab.label}{' '}
            <span className="font-mono opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'upcoming' ? (
        <div role="tabpanel" className="space-y-8">
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
        </div>
      ) : (
        <div role="tabpanel">
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

            <Recommendations />
          </section>
        </div>
      )}
    </>
  );
}

function formatBookingDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function FeaturedBooking({ booking }: { booking: ClientBookingWithDetails }) {
  const locale = useLocale();

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
            label={formatBookingDate(new Date(booking.date), locale)}
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
  const locale = useLocale();

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
          {booking.winery.name} ·{' '}
          {formatBookingDate(new Date(booking.date), locale)} ·{' '}
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

function Recommendations() {
  const recommendations: Array<[string, string]> = [
    ['Dégustation privée', 'Domaines vérifiés'],
    ['Visite de cave', 'Idéal en groupe'],
    ['Accords locaux', 'Weekend'],
  ];

  return (
    <aside className="rounded-[18px] border border-stone-200 bg-white p-5 shadow-audit-card">
      <div className="flex items-center gap-2 font-display text-xl font-semibold">
        <Sparkles className="h-5 w-5 text-burgundy-700" />
        Recommandations
      </div>
      <p className="mt-2 text-sm text-ink-500">
        Accès rapides vers les formats disponibles sur EnCave.
      </p>
      <div className="mt-5 space-y-3">
        {recommendations.map(([title, meta]) => (
          <Link
            key={title}
            href={`/experiences?q=${encodeURIComponent(title)}`}
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
  );
}
