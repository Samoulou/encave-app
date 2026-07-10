'use client';

import { BookingStatus } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Badge, type BadgeProps } from '@/components/ui/badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

/**
 * Canonical booking-status badge. Maps every {@link BookingStatus} to a single
 * `<Badge variant>` so the colors come from the design-system tokens instead of
 * bespoke per-component hex.
 */
const STATUS_VARIANT: Record<BookingStatus, BadgeVariant> = {
  [BookingStatus.CONFIRMED]: 'success',
  [BookingStatus.PENDING_PAYMENT]: 'warning',
  [BookingStatus.COMPLETED]: 'info',
  [BookingStatus.NO_SHOW]: 'neutral',
  [BookingStatus.CANCELLED_BY_CLIENT]: 'destructive',
  [BookingStatus.CANCELLED_BY_WINERY]: 'destructive',
};

const STATUS_LABEL_KEY: Record<BookingStatus, string> = {
  [BookingStatus.CONFIRMED]: 'confirmed',
  [BookingStatus.PENDING_PAYMENT]: 'pending',
  [BookingStatus.COMPLETED]: 'completed',
  [BookingStatus.NO_SHOW]: 'noShow',
  [BookingStatus.CANCELLED_BY_CLIENT]: 'cancelledByClient',
  [BookingStatus.CANCELLED_BY_WINERY]: 'cancelledByWinery',
};

interface BookingStatusBadgeProps {
  status: BookingStatus;
  /**
   * Which label set to use:
   * - `lifecycle` (default): booking-lifecycle wording ("Completed", "No-Show").
   * - `attendance`: roster wording for a session's guest list ("Present",
   *   "Absent (no-show)") shown on the event-detail screen.
   */
  labels?: 'lifecycle' | 'attendance';
  className?: string;
}

export function BookingStatusBadge({
  status,
  labels = 'lifecycle',
  className,
}: BookingStatusBadgeProps) {
  const tLifecycle = useTranslations('bookings.status');
  const tAttendance = useTranslations('Dashboard.eventDetail.bookingStatus');
  const t = labels === 'attendance' ? tAttendance : tLifecycle;

  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {t(STATUS_LABEL_KEY[status])}
    </Badge>
  );
}
