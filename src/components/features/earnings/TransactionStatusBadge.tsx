'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type { TransactionStatus } from '@/server/queries/earnings.queries';

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
  className?: string;
}

/**
 * Transaction status badge matching the mockup design.
 * - Paid: Green with green dot
 * - Pending: Yellow with animated pulsing dot
 * - Processing: Blue with blue dot
 * - Refunded: Gray without dot
 */
export function TransactionStatusBadge({
  status,
  className,
}: TransactionStatusBadgeProps) {
  const t = useTranslations('earnings.transactionStatus');

  const STATUS_CONFIG: Record<
    TransactionStatus,
    {
      bgColor: string;
      textColor: string;
      dotColor: string;
      label: string;
      hasDot: boolean;
      isPulsing: boolean;
    }
  > = {
    paid: {
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      dotColor: 'bg-green-600',
      label: t('paid'),
      hasDot: true,
      isPulsing: false,
    },
    processing: {
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      dotColor: 'bg-blue-600',
      label: t('processing'),
      hasDot: true,
      isPulsing: false,
    },
    pending: {
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      dotColor: 'bg-yellow-600',
      label: t('pending'),
      hasDot: true,
      isPulsing: true,
    },
    refunded: {
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      dotColor: '',
      label: t('refunded'),
      hasDot: false,
      isPulsing: false,
    },
  };

  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      {config.hasDot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            config.dotColor,
            config.isPulsing && 'animate-pulse'
          )}
        />
      )}
      {config.label}
    </span>
  );
}
