'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CancellationPolicy } from '@prisma/client';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { getPolicyTiers } from '@/lib/business-rules/cancellation-policy';
import { setWineryCancellationPolicy } from '@/server/actions/winery-policy';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const POLICIES: readonly CancellationPolicy[] = [
  CancellationPolicy.FLEXIBLE,
  CancellationPolicy.STANDARD,
  CancellationPolicy.STRICT,
];

interface CancellationPolicySectionProps {
  wineryId: string;
  currentPolicy: CancellationPolicy;
}

/**
 * Winery cancellation-policy picker (P-03 / L-043): radio cards for the
 * three policies, each showing its refund barème built from the single
 * source of truth (`getPolicyTiers`) with the existing parametrized
 * `experience.cancellationPolicy.*` i18n keys — never duplicated math.
 */
export function CancellationPolicySection({
  wineryId,
  currentPolicy,
}: CancellationPolicySectionProps) {
  const t = useTranslations('winery.cancellationPolicy');
  const tPolicy = useTranslations('experience.cancellationPolicy');
  const router = useRouter();
  const [selected, setSelected] = useState<CancellationPolicy>(currentPolicy);
  const [saved, setSaved] = useState<CancellationPolicy>(currentPolicy);
  const [hasError, setHasError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isDirty = selected !== saved;

  const handleSave = () => {
    setHasError(false);
    startTransition(async () => {
      const result = await setWineryCancellationPolicy({
        wineryId,
        policy: selected,
      });

      if (!result.success) {
        setHasError(true);
        toast.error(t('updateError'));
        return;
      }

      setSaved(result.data.policy);
      toast.success(t('updated'));
      router.refresh();
    });
  };

  return (
    <Card data-testid="cancellation-policy-section">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={isPending}>
          <legend className="sr-only">{t('title')}</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {POLICIES.map((policy) => {
              const isSelected = selected === policy;
              const tiers = getPolicyTiers(policy);

              return (
                <label key={policy} className="cursor-pointer">
                  <input
                    type="radio"
                    className="peer sr-only"
                    name="cancellationPolicy"
                    value={policy}
                    checked={isSelected}
                    onChange={() => setSelected(policy)}
                  />
                  <div
                    className={cn(
                      'h-full rounded-lg border p-4 transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-stone-200 bg-slate-50 hover:bg-slate-100'
                    )}
                  >
                    <p className="font-semibold text-slate-900">
                      {tPolicy(`labels.${policy}`)}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {tiers.map((tier) => (
                        <li key={tier.minHours}>
                          {tier.minHours >= 48 && tier.minHours % 24 === 0
                            ? tPolicy('tierDays', {
                                percent: tier.percent,
                                days: tier.minHours / 24,
                              })
                            : tPolicy('tierHours', {
                                percent: tier.percent,
                                hours: tier.minHours,
                              })}
                        </li>
                      ))}
                      <li>{tPolicy('noRefundAfter')}</li>
                    </ul>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        {hasError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {t('updateError')}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={!isDirty || isPending}>
            {isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
