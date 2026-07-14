import { useTranslations } from 'next-intl';
import { formatCHF } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';

interface NoShowFeeInfoProps {
  /** No-show fee per guest, in cents. */
  feeCentsPerGuest: number;
  className?: string;
}

/**
 * Human-readable no-show policy (P-12 / L-112): the per-guest fee the winery
 * may charge on a no-show, plus the card-imprint (Stripe SetupIntent)
 * mechanism — no debit at booking. Rendered only for an ON_SITE offer whose
 * winery opted in, with the NO_SHOW_FEES flag ON.
 *
 * Server-safe (no 'use client'): shared by the experience fiche (server) and
 * the checkout summary (client), exactly like CancellationPolicyInfo. i18n
 * only, no browser API.
 */
export function NoShowFeeInfo({
  feeCentsPerGuest,
  className,
}: NoShowFeeInfoProps) {
  const t = useTranslations('experience.noShowPolicy');

  return (
    <div
      className={cn('text-sm text-ink-700', className)}
      data-testid="no-show-fee-info"
    >
      <p>
        <span className="font-semibold text-ink-900">{t('title')}</span>{' '}
        <span className="font-semibold text-burgundy-700">
          {t('amountPerPerson', { amount: formatCHF(feeCentsPerGuest) })}
        </span>
      </p>
      <p className="mt-1">{t('explainer')}</p>
    </div>
  );
}
