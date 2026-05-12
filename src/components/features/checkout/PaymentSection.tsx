'use client';

import { CreditCard, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatCHF } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';

// Card brand icons (simplified SVG placeholders)
function VisaIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-5 w-8 items-center justify-center rounded bg-[#1a1f71]',
        className
      )}
    >
      <span className="text-[8px] font-bold text-white">VISA</span>
    </div>
  );
}

function MastercardIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-5 w-8 items-center justify-center gap-0.5 rounded bg-gray-100',
        className
      )}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
      <div className="-ml-1 h-2.5 w-2.5 rounded-full bg-yellow-500" />
    </div>
  );
}

interface PaymentFormData {
  cardholderName: string;
}

interface PaymentSectionProps {
  register: UseFormRegister<PaymentFormData>;
  errors: FieldErrors<PaymentFormData>;
  isSubmitting: boolean;
  totalPrice: number;
  onSubmit: () => void;
}

export function PaymentSection({
  register,
  errors,
  isSubmitting,
  totalPrice,
  onSubmit,
}: PaymentSectionProps) {
  const t = useTranslations('checkout');

  return (
    <section className="rounded-xl border border-border bg-white p-6 shadow-sm md:p-8">
      {/* Section Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {t('paymentMethod')}
          </h3>
        </div>
        <div className="flex gap-2 opacity-60">
          <VisaIcon />
          <MastercardIcon />
        </div>
      </div>

      <div className="space-y-4">
        {/* Card Information - Combined Input */}
        <div className="flex w-full flex-col">
          <Label
            htmlFor="cardNumber"
            className="pb-2 text-sm font-medium text-foreground"
          >
            {t('cardInformation')}
          </Label>
          <div className="relative flex h-12 w-full items-center rounded-lg border border-border bg-[#fbf9f9] px-4 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <CreditCard
              className="mr-3 h-5 w-5 flex-shrink-0 text-[#915564]"
              aria-hidden="true"
            />
            <input
              id="cardNumber"
              name="cardNumber"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder={t('cardNumberPlaceholder')}
              className="min-w-0 flex-1 border-none bg-transparent text-base text-foreground placeholder:text-[#915564]/60 focus:outline-none focus:ring-0"
              disabled={isSubmitting}
            />
            <div className="ml-2 flex items-center border-l border-border pl-2">
              <input
                id="cardExpiry"
                name="cardExpiry"
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                aria-label={t('cardExpiry')}
                className="w-16 border-none bg-transparent text-center text-base text-foreground placeholder:text-[#915564]/60 focus:outline-none focus:ring-0"
                disabled={isSubmitting}
              />
            </div>
            <div className="ml-2 flex items-center border-l border-border pl-2">
              <input
                id="cardCvc"
                name="cardCvc"
                type="text"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVC"
                aria-label={t('cardCvc')}
                className="w-12 border-none bg-transparent text-center text-base text-foreground placeholder:text-[#915564]/60 focus:outline-none focus:ring-0"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Cardholder Name */}
        <div className="flex w-full flex-col">
          <Label
            htmlFor="cardholderName"
            className="pb-2 text-sm font-medium text-foreground"
          >
            {t('cardholderName')}
          </Label>
          <Input
            id="cardholderName"
            placeholder={t('cardholderNamePlaceholder')}
            autoComplete="cc-name"
            disabled={isSubmitting}
            className="h-12 rounded-lg border-border bg-[#fbf9f9] placeholder:text-[#915564]/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
            {...register('cardholderName')}
          />
          {errors.cardholderName && (
            <p className="mt-1 text-sm text-red-500">
              {errors.cardholderName.message}
            </p>
          )}
        </div>
      </div>

      {/* Trust Badge */}
      <div className="mt-8 flex items-center justify-center gap-2 rounded-lg border border-border bg-primary-light/50 p-3">
        <Lock className="h-4 w-4 text-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">
          {t('securePaymentStripe')}
        </span>
      </div>

      {/* CTA Button */}
      <Button
        type="submit"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="group mt-6 h-14 w-full rounded-lg bg-primary text-lg font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-[hsl(var(--primary-hover))]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
            {t('processing')}
          </>
        ) : (
          <>
            <span>{t('confirmAndPay', { amount: formatCHF(totalPrice) })}</span>
            <ArrowRight
              className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </>
        )}
      </Button>

      {/* Terms Text */}
      <p className="mt-4 text-center text-xs text-[#915564]">
        {t('termsAgreement')}
      </p>
    </section>
  );
}
