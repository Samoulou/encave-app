import { useTranslations } from 'next-intl';
import type { CancellationPolicy } from '@prisma/client';
import { getPolicyTiers } from '@/lib/business-rules/cancellation-policy';
import { cn } from '@/lib/utils';

interface CancellationPolicyInfoProps {
  policy: CancellationPolicy;
  className?: string;
}

/**
 * Human-readable cancellation policy (P-03 / L-043): the winery's policy
 * label plus its refund tiers, built from the single source of truth
 * (`getPolicyTiers`) — never duplicated math in the UI.
 *
 * Shared by the experience page (server) and the checkout summary
 * (client): no 'use client' directive, no browser API, i18n only.
 */
export function CancellationPolicyInfo({
  policy,
  className,
}: CancellationPolicyInfoProps) {
  const t = useTranslations('experience.cancellationPolicy');
  const tiers = getPolicyTiers(policy);

  return (
    <div
      className={cn('text-sm text-ink-700', className)}
      data-testid="cancellation-policy-info"
    >
      <p>
        <span className="font-semibold text-ink-900">{t('title')}</span>{' '}
        <span className="font-semibold text-burgundy-700">
          {t(`labels.${policy}`)}
        </span>
      </p>
      <ul className="mt-1 space-y-0.5">
        {tiers.map((tier) => (
          <li key={tier.minHours}>
            {tier.minHours >= 48 && tier.minHours % 24 === 0
              ? t('tierDays', {
                  percent: tier.percent,
                  days: tier.minHours / 24,
                })
              : t('tierHours', {
                  percent: tier.percent,
                  hours: tier.minHours,
                })}
          </li>
        ))}
        <li>{t('noRefundAfter')}</li>
      </ul>
    </div>
  );
}
