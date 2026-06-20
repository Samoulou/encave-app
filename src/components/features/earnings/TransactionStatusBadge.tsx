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
 * Transaction status badge. Maps each status to a canonical `<Badge variant>`:
 * - paid → success
 * - processing → info (warm primary tint; the old cold "blue" had no warm slot)
 * - pending → warning
 * - refunded → secondary (muted)
 */
const STATUS_CONFIG: Record<
  TransactionStatus,
  { variant: BadgeVariant; labelKey: string }
> = {
  paid: { variant: 'success', labelKey: 'paid' },
  processing: { variant: 'info', labelKey: 'processing' },
  pending: { variant: 'warning', labelKey: 'pending' },
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
