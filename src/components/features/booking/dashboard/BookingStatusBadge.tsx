import { BookingStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

/**
 * Status badge configuration matching US-UI-09 mockup.
 * Each status has specific colors for background, text, border, and dot.
 */
const STATUS_CONFIG: Record<
  BookingStatus,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  [BookingStatus.CONFIRMED]: {
    bg: 'bg-[#ecfdf5]',
    text: 'text-[#047857]',
    border: 'border-[#d1fae5]',
    dot: 'bg-[#047857]',
    label: 'Confirmed',
  },
  [BookingStatus.PENDING_PAYMENT]: {
    bg: 'bg-[#fffbeb]',
    text: 'text-[#b45309]',
    border: 'border-[#fef3c7]',
    dot: 'bg-[#b45309]',
    label: 'Pending',
  },
  [BookingStatus.CANCELLED_BY_CLIENT]: {
    bg: 'bg-[#fef2f2]',
    text: 'text-[#991b1b]',
    border: 'border-[#fee2e2]',
    dot: 'bg-[#991b1b]',
    label: 'Cancelled',
  },
  [BookingStatus.CANCELLED_BY_WINERY]: {
    bg: 'bg-[#fef2f2]',
    text: 'text-[#991b1b]',
    border: 'border-[#fee2e2]',
    dot: 'bg-[#991b1b]',
    label: 'Cancelled',
  },
  [BookingStatus.COMPLETED]: {
    bg: 'bg-[#eff6ff]',
    text: 'text-[#1d4ed8]',
    border: 'border-[#dbeafe]',
    dot: 'bg-[#1d4ed8]',
    label: 'Completed',
  },
  [BookingStatus.NO_SHOW]: {
    bg: 'bg-[#f3f4f6]',
    text: 'text-[#374151]',
    border: 'border-[#e5e7eb]',
    dot: 'bg-[#374151]',
    label: 'No-Show',
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
      {config.label}
    </span>
  );
}
