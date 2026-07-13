'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CancellationPolicy } from '@prisma/client';
import { formatCHF } from '@/lib/utils/currency';
import { OrderSummary } from './OrderSummary';

interface MobileOrderSummaryProps {
  experienceTitle: string;
  experienceImage?: string | null;
  location: string;
  date: string;
  time: string;
  duration?: number;
  guestCount: number;
  pricePerPerson: number;
  serviceFee?: number;
  /** Gift-card amount applied at checkout in cents (P-09), 0 when none. */
  giftAppliedCents?: number;
  /** Winery cancellation policy — forwarded to the expanded summary. */
  cancellationPolicy: CancellationPolicy;
}

export function MobileOrderSummary(props: MobileOrderSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useTranslations('checkout');

  const total = Math.max(
    0,
    props.pricePerPerson * props.guestCount +
      (props.serviceFee ?? 0) -
      (props.giftAppliedCents ?? 0)
  );

  return (
    <div className="lg:hidden">
      {/* Collapsed View */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-foreground">
            {t('orderSummary')}
          </span>
          <span className="text-lg font-bold text-primary">
            {formatCHF(total)}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="mt-4">
          <OrderSummary {...props} />
        </div>
      )}
    </div>
  );
}
