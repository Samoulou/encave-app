import { BookingStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  BookingStatus,
  { color: string; label: string }
> = {
  [BookingStatus.PENDING_PAYMENT]: {
    color: 'bg-yellow-100 text-yellow-800',
    label: 'Pending',
  },
  [BookingStatus.CONFIRMED]: {
    color: 'bg-green-100 text-green-800',
    label: 'Confirmed',
  },
  [BookingStatus.COMPLETED]: {
    color: 'bg-blue-100 text-blue-800',
    label: 'Completed',
  },
  [BookingStatus.CANCELLED_BY_CLIENT]: {
    color: 'bg-gray-100 text-gray-800',
    label: 'Cancelled',
  },
  [BookingStatus.CANCELLED_BY_WINERY]: {
    color: 'bg-gray-100 text-gray-800',
    label: 'Cancelled',
  },
  [BookingStatus.NO_SHOW]: {
    color: 'bg-red-100 text-red-800',
    label: 'No-Show',
  },
};

interface BookingStatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
