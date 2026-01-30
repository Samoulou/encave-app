'use client';

import { BookingStatus } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Status badge configuration matching US-UI-09 mockup.
 * Each status has specific colors for background, text, border, and dot.
 */
const STATUS_CONFIG: Record<
  BookingStatus,
  { bg: string; text: string; border: string; dot: string; labelKey: string }
> = {
  [BookingStatus.CONFIRMED]: {
    bg: 'bg-[#ecfdf5]',
    text: 'text-[#047857]',
    border: 'border-[#d1fae5]',
    dot: 'bg-[#047857]',
    labelKey: 'confirmed',
  },
  [BookingStatus.PENDING_PAYMENT]: {
    bg: 'bg-[#fffbeb]',
    text: 'text-[#b45309]',
    border: 'border-[#fef3c7]',
    dot: 'bg-[#b45309]',
    labelKey: 'pending',
  },
  [BookingStatus.CANCELLED_BY_CLIENT]: {
    bg: 'bg-[#fef2f2]',
    text: 'text-[#991b1b]',
    border: 'border-[#fee2e2]',
    dot: 'bg-[#991b1b]',
    labelKey: 'cancelledByClient',
  },
  [BookingStatus.CANCELLED_BY_WINERY]: {
    bg: 'bg-[#fef2f2]',
    text: 'text-[#991b1b]',
    border: 'border-[#fee2e2]',
    dot: 'bg-[#991b1b]',
    labelKey: 'cancelledByWinery',
  },
  [BookingStatus.COMPLETED]: {
    bg: 'bg-[#eff6ff]',
    text: 'text-[#1d4ed8]',
    border: 'border-[#dbeafe]',
    dot: 'bg-[#1d4ed8]',
    labelKey: 'completed',
  },
  [BookingStatus.NO_SHOW]: {
    bg: 'bg-[#f3f4f6]',
    text: 'text-[#374151]',
    border: 'border-[#e5e7eb]',
    dot: 'bg-[#374151]',
    labelKey: 'noShow',
  },
};

interface BookingStatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

/**
 * Status badge component with dot indicator matching US-UI-09 mockup.
 */
export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const t = useTranslations('bookings.status');
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', config.dot)} />
      {t(config.labelKey)}
    </span>
  );
}
