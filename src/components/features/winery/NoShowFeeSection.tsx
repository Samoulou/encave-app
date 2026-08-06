'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { setWineryNoShowPolicy } from '@/server/actions/winery-policy';
import {
  NO_SHOW_FEE_MAX_CENTS,
  NO_SHOW_FEE_MIN_CENTS,
} from '@/lib/constants/pricing';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NoShowFeeSectionProps {
  wineryId: string;
  currentEnabled: boolean;
  currentFeeCents: number;
}

/**
 * Winery no-show fee opt-in (P-08 / L-070, US-220): a toggle + a per-guest
 * amount (0–50 CHF). Only ever effective on ON_SITE / free offers when the
 * NO_SHOW_FEES flag is ON — the parent renders this card only in that case.
 */
export function NoShowFeeSection({
  wineryId,
  currentEnabled,
  currentFeeCents,
}: NoShowFeeSectionProps) {
  const t = useTranslations('winery.noShowFee');
  const router = useRouter();
  const [enabled, setEnabled] = useState(currentEnabled);
  const [feeChf, setFeeChf] = useState(String(currentFeeCents / 100));
  const [savedEnabled, setSavedEnabled] = useState(currentEnabled);
  const [savedFeeChf, setSavedFeeChf] = useState(String(currentFeeCents / 100));
  const [isPending, startTransition] = useTransition();

  const feeCents = Math.round(Number(feeChf) * 100);
  const feeValid =
    Number.isFinite(feeCents) &&
    feeCents >= NO_SHOW_FEE_MIN_CENTS &&
    feeCents <= NO_SHOW_FEE_MAX_CENTS;
  const isDirty = enabled !== savedEnabled || feeChf !== savedFeeChf;

  const handleSave = () => {
    if (!feeValid) {
      toast.error(t('invalidAmount'));
      return;
    }
    startTransition(async () => {
      const result = await setWineryNoShowPolicy({
        wineryId,
        enabled,
        feeCents,
      });
      if (!result.success) {
        toast.error(t('updateError'));
        return;
      }
      setSavedEnabled(result.data.enabled);
      setSavedFeeChf(String(result.data.feeCents / 100));
      toast.success(t('updated'));
      router.refresh();
    });
  };

  return (
    <Card data-testid="no-show-fee-section">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="no-show-enabled" className="cursor-pointer">
            {t('enableLabel')}
          </Label>
          <Switch
            id="no-show-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="no-show-fee">{t('amountLabel')}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="no-show-fee"
              type="number"
              min={NO_SHOW_FEE_MIN_CENTS / 100}
              max={NO_SHOW_FEE_MAX_CENTS / 100}
              step={1}
              inputMode="numeric"
              value={feeChf}
              disabled={!enabled || isPending}
              onChange={(e) => setFeeChf(e.target.value)}
              className="max-w-[8rem]"
              aria-invalid={!feeValid}
            />
            <span className="text-sm text-muted-foreground">
              {t('perGuest')}
            </span>
          </div>
          {!feeValid && (
            <p role="alert" className="text-sm text-red-600">
              {t('invalidAmount')}
            </p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{t('note')}</p>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!isDirty || !feeValid || isPending}
          >
            {isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
