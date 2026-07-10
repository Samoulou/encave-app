'use client';

import { useTranslations } from 'next-intl';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { TransactionStatus } from '@/server/queries/earnings.queries';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
  className?: string;
}

/**
 * Transaction status badge (P-13: booking facts, no payout guessing):
 * - completed → success (experience held)
 * - upcoming → warning (experience not held yet)
 * - refunded → secondary (muted)
 */
const STATUS_CONFIG: Record<
  TransactionStatus,
  { variant: BadgeVariant; labelKey: string }
> = {
  completed: { variant: 'success', labelKey: 'completed' },
  upcoming: { variant: 'warning', labelKey: 'upcoming' },
  refunded: { variant: 'secondary', labelKey: 'refunded' },
};

export function TransactionStatusBadge({
  status,
  className,
}: TransactionStatusBadgeProps) {
  const t = useTranslations('earnings.transactionStatus');
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant} className={className}>
      {t(config.labelKey)}
    </Badge>
  );
}
