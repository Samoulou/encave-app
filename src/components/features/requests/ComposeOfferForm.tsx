'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  composeOfferFormSchema,
  type ComposeOfferFormValues,
} from '@/lib/validators/request';
import {
  REQUEST_OFFER_MIN_VALIDITY_DAYS,
  REQUEST_OFFER_MAX_VALIDITY_DAYS,
} from '@/lib/constants/request';
import { composeRequestOfferAction } from '@/server/actions/request';

const DEFAULT_VALIDITY_DAYS = 7;

/**
 * Winemaker offer composer (P-10 / L-091). Only mounted when the request
 * is PENDING. Price is entered in CHF (all-in) and converted to cents at
 * submit. On success, refreshes the detail page so the sent offer renders.
 */
export function ComposeOfferForm({ requestId }: { requestId: string }) {
  const t = useTranslations('requests');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ComposeOfferFormValues>({
    resolver: zodResolver(composeOfferFormSchema),
    defaultValues: {
      message: '',
      scheduledDate: '',
      scheduledStartTime: '',
      validityDays: DEFAULT_VALIDITY_DAYS,
    },
  });

  function onSubmit(values: ComposeOfferFormValues) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await composeRequestOfferAction({
        requestId,
        message: values.message,
        totalPriceCents: Math.round(values.totalPriceChf * 100),
        scheduledDate: values.scheduledDate,
        scheduledStartTime: values.scheduledStartTime,
        validityDays: values.validityDays,
      });

      if (result.success) {
        router.refresh();
        return;
      }

      switch (result.error.code) {
        case 'VALIDATION_ERROR':
          setSubmitError(t('errorValidation'));
          break;
        case 'CONFLICT':
          setSubmitError(t('errorConflict'));
          break;
        default:
          setSubmitError(t('errorGeneric'));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="message">{t('messageLabel')}</Label>
        <Textarea
          id="message"
          rows={5}
          placeholder={t('messagePlaceholder')}
          {...register('message')}
        />
        {errors.message && (
          <p className="text-sm text-destructive" role="alert">
            {t('errorMessageShort')}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="totalPriceChf">{t('priceLabel')}</Label>
        <Input
          id="totalPriceChf"
          type="number"
          inputMode="decimal"
          step="0.05"
          min={0}
          placeholder={t('pricePlaceholder')}
          {...register('totalPriceChf', { valueAsNumber: true })}
        />
        <p className="text-xs text-muted-foreground">{t('priceHelp')}</p>
        {errors.totalPriceChf && (
          <p className="text-sm text-destructive" role="alert">
            {t('errorPriceInvalid')}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scheduledDate">{t('dateLabel')}</Label>
          <Input
            id="scheduledDate"
            type="date"
            {...register('scheduledDate')}
          />
          {errors.scheduledDate && (
            <p className="text-sm text-destructive" role="alert">
              {t('errorDateRequired')}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="scheduledStartTime">{t('timeLabel')}</Label>
          <Input
            id="scheduledStartTime"
            type="time"
            {...register('scheduledStartTime')}
          />
          {errors.scheduledStartTime && (
            <p className="text-sm text-destructive" role="alert">
              {t('errorTimeInvalid')}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="validityDays">{t('validityLabel')}</Label>
        <Input
          id="validityDays"
          type="number"
          inputMode="numeric"
          min={REQUEST_OFFER_MIN_VALIDITY_DAYS}
          max={REQUEST_OFFER_MAX_VALIDITY_DAYS}
          {...register('validityDays', { valueAsNumber: true })}
        />
        <p className="text-xs text-muted-foreground">{t('validityHelp')}</p>
      </div>

      {submitError && (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? t('sending') : t('send')}
      </Button>
    </form>
  );
}
