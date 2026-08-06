'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations, useLocale } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  requestFormSchema,
  type RequestFormValues,
} from '@/lib/validators/request';
import { REQUEST_GUEST_MIN, REQUEST_GUEST_MAX } from '@/lib/constants/request';
import { createRequestAction } from '@/server/actions/request';
import type { RequestableWinery } from '@/server/queries/request.queries';

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface RequestFormProps {
  /** Full mode (/sur-mesure): a winery must be picked from this list. */
  wineries?: RequestableWinery[];
  /** Block mode (winery fiche): the winery is fixed and hidden. */
  fixedWinery?: { id: string; name: string };
  variant?: 'full' | 'compact';
}

/**
 * Shared sur-mesure request form (P-10 / L-090). Drives both the global
 * /sur-mesure page (winery select) and the compact fiche block (fixed
 * winery). Validates with requestFormSchema; budget is entered in CHF and
 * converted to cents at submit. Never throws — surfaces the ActionResult
 * error via a translated message.
 */
export function RequestForm({
  wineries,
  fixedWinery,
  variant = 'full',
}: RequestFormProps) {
  const t = useTranslations('surMesure');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      wineryId: fixedWinery?.id ?? '',
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      desiredDate: '',
      guestCount: 2,
      description: '',
    },
  });

  const wineryId = watch('wineryId');

  function onSubmit(values: RequestFormValues) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await createRequestAction({
        wineryId: values.wineryId,
        clientName: values.clientName,
        clientEmail: values.clientEmail,
        clientPhone: values.clientPhone ? values.clientPhone : undefined,
        desiredDate: values.desiredDate ? values.desiredDate : undefined,
        guestCount: values.guestCount,
        budgetCents:
          values.budgetChf != null && !Number.isNaN(values.budgetChf)
            ? Math.round(values.budgetChf * 100)
            : undefined,
        description: values.description,
        locale: locale as 'fr' | 'de' | 'en',
      });

      if (result.success) {
        setSubmittedRef(result.data.requestReference);
        reset();
        return;
      }

      switch (result.error.code) {
        case 'RATE_LIMITED':
          setSubmitError(t('errorRateLimited'));
          break;
        case 'NOT_FOUND':
          setSubmitError(t('errorNotFound'));
          break;
        default:
          setSubmitError(t('errorGeneric'));
      }
    });
  }

  if (submittedRef) {
    return (
      <div
        role="status"
        className="rounded-xl border border-success/25 bg-success/10 p-6 text-center"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-xl font-semibold text-foreground">
          {t('successTitle')}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t('successBody')}
        </p>
        <div className="mx-auto mt-4 inline-flex flex-col items-center rounded-lg border border-border bg-card px-5 py-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('successRefLabel')}
          </span>
          <span className="mt-1 font-mono text-lg font-semibold tracking-widest text-foreground">
            {submittedRef}
          </span>
        </div>
        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSubmittedRef(null);
              setSubmitError(null);
            }}
          >
            {t('successAgain')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn('space-y-6', variant === 'compact' && 'space-y-4')}
      noValidate
    >
      {/* Winery: select (full) or hidden (block) */}
      {fixedWinery ? (
        <input type="hidden" {...register('wineryId')} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="wineryId">{t('wineryLabel')}</Label>
          <Select
            value={wineryId || ''}
            onValueChange={(value) =>
              setValue('wineryId', value, { shouldValidate: true })
            }
          >
            <SelectTrigger id="wineryId">
              <SelectValue placeholder={t('wineryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {(wineries ?? []).map((winery) => (
                <SelectItem key={winery.id} value={winery.id}>
                  {winery.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.wineryId && (
            <p className="text-sm text-destructive" role="alert">
              {t('errorWineryRequired')}
            </p>
          )}
        </div>
      )}

      <div className={cn('grid gap-4', variant === 'full' && 'sm:grid-cols-2')}>
        <div className="space-y-2">
          <Label htmlFor="clientName">{t('clientNameLabel')}</Label>
          <Input
            id="clientName"
            autoComplete="name"
            placeholder={t('clientNamePlaceholder')}
            {...register('clientName')}
          />
          {errors.clientName && (
            <p className="text-sm text-destructive" role="alert">
              {t('errorNameRequired')}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientEmail">{t('clientEmailLabel')}</Label>
          <Input
            id="clientEmail"
            type="email"
            autoComplete="email"
            placeholder={t('clientEmailPlaceholder')}
            {...register('clientEmail')}
          />
          {errors.clientEmail && (
            <p className="text-sm text-destructive" role="alert">
              {t('errorEmailInvalid')}
            </p>
          )}
        </div>
      </div>

      <div className={cn('grid gap-4', variant === 'full' && 'sm:grid-cols-2')}>
        <div className="space-y-2">
          <Label htmlFor="clientPhone">{t('clientPhoneLabel')}</Label>
          <Input
            id="clientPhone"
            type="tel"
            autoComplete="tel"
            placeholder={t('clientPhonePlaceholder')}
            {...register('clientPhone')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="desiredDate">{t('desiredDateLabel')}</Label>
          <Input
            id="desiredDate"
            type="date"
            min={todayKey()}
            {...register('desiredDate')}
          />
        </div>
      </div>

      <div className={cn('grid gap-4', variant === 'full' && 'sm:grid-cols-2')}>
        <div className="space-y-2">
          <Label htmlFor="guestCount">{t('guestCountLabel')}</Label>
          <Input
            id="guestCount"
            type="number"
            inputMode="numeric"
            min={REQUEST_GUEST_MIN}
            max={REQUEST_GUEST_MAX}
            {...register('guestCount', { valueAsNumber: true })}
          />
          {errors.guestCount && (
            <p className="text-sm text-destructive" role="alert">
              {t('errorGuestCount')}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="budgetChf">{t('budgetLabel')}</Label>
          <Input
            id="budgetChf"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={t('budgetPlaceholder')}
            {...register('budgetChf', {
              setValueAs: (value) =>
                value === '' || value === null || value === undefined
                  ? undefined
                  : Number(value),
            })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('descriptionLabel')}</Label>
        <Textarea
          id="description"
          rows={variant === 'compact' ? 3 : 5}
          placeholder={t('descriptionPlaceholder')}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive" role="alert">
            {t('errorDescriptionShort')}
          </p>
        )}
      </div>

      {submitError && (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
