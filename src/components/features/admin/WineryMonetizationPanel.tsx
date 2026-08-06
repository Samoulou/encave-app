'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { WineryPlan } from '@prisma/client';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setWineryPlan } from '@/server/actions/admin';

// Local literal list (type-checked against the Prisma enum) — avoids
// pulling @prisma/client values into the client bundle.
const PLANS = Object.values(WineryPlan);

interface WineryMonetizationPanelProps {
  wineryId: string;
  plan: WineryPlan;
  /** Stored fraction (0–1); null = platform default rate. */
  commissionRate: number | null;
}

function rateToPercentInput(rate: number | null): string {
  if (rate === null) return '';
  // Avoid float noise (0.12 * 100 → 12.000000000000002)
  return String(Math.round(rate * 10000) / 100);
}

/**
 * Admin controls for a winery's plan + commission rate (P-03 / L-042).
 * The rate is edited as a percentage (0–100); empty means "platform
 * default" and is stored as null.
 */
export function WineryMonetizationPanel({
  wineryId,
  plan: initialPlan,
  commissionRate,
}: WineryMonetizationPanelProps) {
  const t = useTranslations('admin.monetization');
  const router = useRouter();
  const [plan, setPlan] = useState<WineryPlan>(initialPlan);
  const [ratePercent, setRatePercent] = useState<string>(
    rateToPercentInput(commissionRate)
  );
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmed = ratePercent.trim();
    let percentValue: number | null = null;
    if (trimmed !== '') {
      const parsed = Number(trimmed.replace(',', '.'));
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        toast.error(t('invalidRate'));
        return;
      }
      percentValue = parsed;
    }

    startTransition(async () => {
      const result = await setWineryPlan(wineryId, plan, percentValue);
      if (result.success) {
        toast.success(t('saved'));
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="font-medium text-slate-900">{t('title')}</p>
      <p className="text-sm text-slate-500">{t('description')}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="winery-plan">{t('planLabel')}</Label>
          <Select
            value={plan}
            onValueChange={(value) => setPlan(value as WineryPlan)}
            disabled={isPending}
          >
            <SelectTrigger id="winery-plan" data-testid="winery-plan-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`plans.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="winery-commission-rate">{t('commissionLabel')}</Label>
          <Input
            id="winery-commission-rate"
            data-testid="winery-commission-rate"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            value={ratePercent}
            onChange={(event) => setRatePercent(event.target.value)}
            placeholder={t('commissionPlaceholder')}
            disabled={isPending}
          />
          <p className="text-xs text-slate-500">{t('commissionHelp')}</p>
        </div>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          onClick={submit}
          disabled={isPending}
          data-testid="save-winery-plan"
        >
          {isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}
