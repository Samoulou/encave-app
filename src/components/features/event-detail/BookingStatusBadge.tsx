import { getTranslations } from 'next-intl/server';
import { BookingStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

interface BookingStatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

const STATUS_STYLE: Record<BookingStatus, { className: string; key: string }> =
  {
    [BookingStatus.PENDING_PAYMENT]: {
      className: 'bg-amber-50 text-amber-800 border-amber-200',
      key: 'confirmed', // unused — PENDING_PAYMENT is never shown here
    },
    [BookingStatus.CONFIRMED]: {
      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      key: 'confirmed',
    },
    [BookingStatus.COMPLETED]: {
      className: 'bg-blue-50 text-blue-800 border-blue-200',
      key: 'completed',
    },
    [BookingStatus.NO_SHOW]: {
      className: 'bg-slate-100 text-slate-700 border-slate-200',
      key: 'noShow',
    },
    [BookingStatus.CANCELLED_BY_CLIENT]: {
      className: 'bg-rose-50 text-rose-800 border-rose-200',
      key: 'cancelledByClient',
    },
    [BookingStatus.CANCELLED_BY_WINERY]: {
      className: 'bg-rose-50 text-rose-800 border-rose-200',
      key: 'cancelledByWinery',
    },
  };

export async function BookingStatusBadge({
  status,
  className,
}: BookingStatusBadgeProps) {
  const t = await getTranslations('Dashboard.eventDetail.bookingStatus');
  const config = STATUS_STYLE[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        config.className,
        className
      )}
    >
      {t(config.key)}
    </span>
  );
}
