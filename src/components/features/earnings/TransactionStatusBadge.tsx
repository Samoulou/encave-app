import { cn } from '@/lib/utils';
import type { TransactionStatus } from '@/server/queries/earnings.queries';

const STATUS_CONFIG: Record<TransactionStatus, { color: string; label: string }> = {
  paid: {
    color: 'bg-green-100 text-green-800',
    label: 'Paid',
  },
  pending: {
    color: 'bg-yellow-100 text-yellow-800',
    label: 'Pending',
  },
  refunded: {
    color: 'bg-gray-100 text-gray-800',
    label: 'Refunded',
  },
};

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
  className?: string;
}

export function TransactionStatusBadge({
  status,
  className,
}: TransactionStatusBadgeProps) {
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
