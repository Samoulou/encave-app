import { getTranslations } from 'next-intl/server';
import { CalendarCheck, Users, Wallet, Gauge } from 'lucide-react';
import { getBookingSummary } from '@/server/queries/booking.queries';
import {
  getMonthGrossRevenue,
  getWineryFillRate30d,
} from '@/server/queries/dashboard-today.queries';
import { formatCHF } from '@/lib/utils/currency';

interface TodayKpisProps {
  userId: string;
  wineryId: string;
}

/**
 * The four « Aujourd'hui » KPIs (L-130): today's bookings, 7-day covers,
 * gross month revenue (D3) and the REAL 30-day fill rate on persisted
 * occurrences — the honest successor of the removed placebo (L-011).
 */
export async function TodayKpis({ userId, wineryId }: TodayKpisProps) {
  const [summary, monthGross, fillRate, t] = await Promise.all([
    getBookingSummary(wineryId),
    getMonthGrossRevenue(userId),
    getWineryFillRate30d(userId),
    getTranslations('Dashboard.today.kpis'),
  ]);

  const cards = [
    {
      key: 'todayBookings',
      icon: CalendarCheck,
      value: String(summary.todayCount),
      hint: t('todayGuests', { count: summary.todayGuests }),
    },
    {
      key: 'weekGuests',
      icon: Users,
      value: String(summary.weekGuests),
      hint: t('weekBookings', { count: summary.weekCount }),
    },
    {
      key: 'monthGross',
      icon: Wallet,
      value: formatCHF(monthGross),
      hint: t('monthBookings', { count: summary.monthCount }),
    },
    {
      key: 'fillRate',
      icon: Gauge,
      value: fillRate.ratePct !== null ? `${fillRate.ratePct}%` : '—',
      hint:
        fillRate.ratePct !== null
          ? t('fillRateHint', {
              sold: fillRate.soldSeats,
              offered: fillRate.offeredSeats,
            })
          : t('fillRateEmpty'),
    },
  ] as const;

  return (
    <section
      aria-label={t('sectionLabel')}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
    >
      {cards.map(({ key, icon: Icon, value, hint }) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-white p-4 lg:p-5"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium">{t(key)}</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground lg:text-3xl">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      ))}
    </section>
  );
}
