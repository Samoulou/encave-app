'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations, useLocale } from 'next-intl';
import { addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatCHF } from '@/lib/utils/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  giftCardFormSchema,
  type GiftCardFormValues,
} from '@/lib/validators/giftCard';
import {
  GIFT_CARD_MIN_AMOUNT_CENTS,
  GIFT_CARD_MAX_AMOUNT_CENTS,
  GIFT_CARD_AMOUNT_STEP_CENTS,
  GIFT_CARD_PURCHASE_FEE_CENTS,
  GIFT_CARD_VARIANTS,
} from '@/lib/constants/gift-card';
import { createGiftCardCheckoutAction } from '@/server/actions/giftCard';
import type { GiftableExperience } from '@/server/queries/giftCard.queries';
import { GiftCardPreview } from './GiftCardPreview';

const AMOUNT_OPTIONS: number[] = [];
for (
  let cents = GIFT_CARD_MIN_AMOUNT_CENTS;
  cents <= GIFT_CARD_MAX_AMOUNT_CENTS;
  cents += GIFT_CARD_AMOUNT_STEP_CENTS
) {
  AMOUNT_OPTIONS.push(cents);
}

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function GiftCardConfigurator({
  experiences,
}: {
  experiences: GiftableExperience[];
}) {
  const t = useTranslations('giftCards');
  const locale = useLocale();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<GiftCardFormValues>({
    resolver: zodResolver(giftCardFormSchema),
    defaultValues: {
      nature: 'AMOUNT',
      amountCents: 10000,
      variant: 'NEUTRE',
      deliverDate: todayKey(),
      purchaserName: '',
      purchaserEmail: '',
      recipientName: '',
      recipientEmail: '',
      message: '',
    },
  });

  const nature = watch('nature');
  const amountCents = watch('amountCents');
  const variant = watch('variant');
  const experienceId = watch('experienceId');
  const purchaserName = watch('purchaserName');
  const message = watch('message');

  const selectedExperience = experiences.find((e) => e.id === experienceId);
  const previewAmount =
    nature === 'EXPERIENCE' ? (selectedExperience?.price ?? 0) : amountCents;

  const maxDeliver = (() => {
    const d = addDays(new Date(), 365);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  async function onSubmit(values: GiftCardFormValues) {
    setSubmitError(null);
    const deliverAtISO = new Date(
      `${values.deliverDate}T12:00:00Z`
    ).toISOString();
    const shared = {
      purchaserName: values.purchaserName,
      purchaserEmail: values.purchaserEmail,
      recipientEmail: values.recipientEmail,
      recipientName: values.recipientName || undefined,
      message: values.message || undefined,
      deliverAt: deliverAtISO,
      variant: values.variant,
      locale: locale as 'fr' | 'de' | 'en',
    };
    const result = await createGiftCardCheckoutAction(
      values.nature === 'EXPERIENCE'
        ? {
            ...shared,
            nature: 'EXPERIENCE',
            experienceId: values.experienceId ?? '',
          }
        : { ...shared, nature: 'AMOUNT', amountCents: values.amountCents }
    );
    if (result.success) {
      window.location.href = result.data.checkoutUrl;
      return;
    }
    setSubmitError(t('errorGeneric'));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Nature */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t('natureLabel')}</legend>
          <div className="grid grid-cols-2 gap-3">
            {(['AMOUNT', 'EXPERIENCE'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setValue('nature', option)}
                className={cn(
                  'rounded-lg border-2 p-3 text-sm transition-colors',
                  nature === option
                    ? 'border-primary bg-accent'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {option === 'AMOUNT'
                  ? t('natureAmount')
                  : t('natureExperience')}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Amount or experience */}
        {nature === 'AMOUNT' ? (
          <div className="space-y-2">
            <Label>{t('amountLabel')}</Label>
            <Select
              value={String(amountCents)}
              onValueChange={(v) => setValue('amountCents', Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AMOUNT_OPTIONS.map((cents) => (
                  <SelectItem key={cents} value={String(cents)}>
                    {formatCHF(cents)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>{t('experienceLabel')}</Label>
            <Select
              value={experienceId ?? ''}
              onValueChange={(v) => setValue('experienceId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('experiencePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {experiences.map((exp) => (
                  <SelectItem key={exp.id} value={exp.id}>
                    {exp.title} — {exp.wineryName} ({formatCHF(exp.price)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.experienceId && (
              <p className="text-sm text-destructive">
                {t('experiencePlaceholder')}
              </p>
            )}
          </div>
        )}

        {/* Variant */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t('variantLabel')}</legend>
          <div className="grid grid-cols-3 gap-3">
            {GIFT_CARD_VARIANTS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setValue('variant', option)}
                className={cn(
                  'rounded-lg border-2 p-2 text-sm transition-colors',
                  variant === option
                    ? 'border-primary bg-accent'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {t(`variant${option}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Purchaser */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">
            {t('purchaserSection')}
          </legend>
          <div className="space-y-2">
            <Label htmlFor="purchaserName">{t('purchaserName')}</Label>
            <Input
              id="purchaserName"
              placeholder={t('purchaserNamePlaceholder')}
              {...register('purchaserName')}
            />
            {errors.purchaserName && (
              <p className="text-sm text-destructive">
                {errors.purchaserName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchaserEmail">{t('purchaserEmail')}</Label>
            <Input
              id="purchaserEmail"
              type="email"
              placeholder={t('purchaserEmailPlaceholder')}
              {...register('purchaserEmail')}
            />
            {errors.purchaserEmail && (
              <p className="text-sm text-destructive">
                {errors.purchaserEmail.message}
              </p>
            )}
          </div>
        </fieldset>

        {/* Recipient */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">
            {t('recipientSection')}
          </legend>
          <div className="space-y-2">
            <Label htmlFor="recipientName">{t('recipientName')}</Label>
            <Input
              id="recipientName"
              placeholder={t('recipientNamePlaceholder')}
              {...register('recipientName')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">{t('recipientEmail')}</Label>
            <Input
              id="recipientEmail"
              type="email"
              placeholder={t('recipientEmailPlaceholder')}
              {...register('recipientEmail')}
            />
            {errors.recipientEmail && (
              <p className="text-sm text-destructive">
                {errors.recipientEmail.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">{t('messageLabel')}</Label>
            <Textarea
              id="message"
              rows={3}
              placeholder={t('messagePlaceholder')}
              {...register('message')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliverDate">{t('deliverAtLabel')}</Label>
            <Input
              id="deliverDate"
              type="date"
              min={todayKey()}
              max={maxDeliver}
              {...register('deliverDate')}
            />
            <p className="text-sm text-muted-foreground">
              {t('deliverAtHelp')}
            </p>
          </div>
        </fieldset>

        <div className="space-y-3 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            {t('feeNotice', { fee: formatCHF(GIFT_CARD_PURCHASE_FEE_CENTS) })}
          </p>
          <p className="font-serif text-lg font-semibold">
            {t('totalLabel', {
              total: formatCHF(previewAmount + GIFT_CARD_PURCHASE_FEE_CENTS),
            })}
          </p>
          {submitError && (
            <p className="text-sm text-destructive" role="alert">
              {submitError}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </form>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <GiftCardPreview
          variant={variant}
          amount={formatCHF(previewAmount)}
          experienceTitle={
            nature === 'EXPERIENCE' ? selectedExperience?.title : undefined
          }
          purchaserName={purchaserName}
          message={message}
        />
      </div>
    </div>
  );
}
