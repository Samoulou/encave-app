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
    <div className={cn('w-8 h-5 bg-[#1a1f71] rounded flex items-center justify-center', className)}>
      <span className="text-[8px] font-bold text-white">VISA</span>
    </div>
  );
}

function MastercardIcon({ className }: { className?: string }) {
  return (
    <div className={cn('w-8 h-5 bg-gray-100 rounded flex items-center justify-center gap-0.5', className)}>
      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 -ml-1" />
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
    <section className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-[#e5d2d7]">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-[#1a0f12]">{t('paymentMethod')}</h3>
        </div>
        <div className="flex gap-2 opacity-60">
          <VisaIcon />
          <MastercardIcon />
        </div>
      </div>

      <div className="space-y-4">
        {/* Card Information - Combined Input */}
        <div className="flex flex-col w-full">
          <Label htmlFor="cardNumber" className="text-[#1a0f12] text-sm font-medium pb-2">
            {t('cardInformation')}
          </Label>
          <div className="relative flex items-center w-full rounded-lg border border-[#e5d2d7] bg-[#fbf9f9] px-4 h-12 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
            <CreditCard className="h-5 w-5 text-[#915564] mr-3 flex-shrink-0" aria-hidden="true" />
            <input
              id="cardNumber"
              name="cardNumber"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder={t('cardNumberPlaceholder')}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-[#1a0f12] placeholder:text-[#915564]/60 text-base min-w-0"
              disabled={isSubmitting}
            />
            <div className="flex items-center border-l border-[#e5d2d7] ml-2 pl-2">
              <input
                id="cardExpiry"
                name="cardExpiry"
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                aria-label={t('cardExpiry')}
                className="w-16 bg-transparent border-none focus:ring-0 focus:outline-none text-[#1a0f12] placeholder:text-[#915564]/60 text-center text-base"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center border-l border-[#e5d2d7] ml-2 pl-2">
              <input
                id="cardCvc"
                name="cardCvc"
                type="text"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVC"
                aria-label={t('cardCvc')}
                className="w-12 bg-transparent border-none focus:ring-0 focus:outline-none text-[#1a0f12] placeholder:text-[#915564]/60 text-center text-base"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Cardholder Name */}
        <div className="flex flex-col w-full">
          <Label htmlFor="cardholderName" className="text-[#1a0f12] text-sm font-medium pb-2">
            {t('cardholderName')}
          </Label>
          <Input
            id="cardholderName"
            placeholder={t('cardholderNamePlaceholder')}
            autoComplete="cc-name"
            disabled={isSubmitting}
            className="h-12 rounded-lg border-[#e5d2d7] bg-[#fbf9f9] focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-[#915564]/60"
            {...register('cardholderName')}
          />
          {errors.cardholderName && (
            <p className="text-sm text-red-500 mt-1">{errors.cardholderName.message}</p>
          )}
        </div>
      </div>

      {/* Trust Badge */}
      <div className="mt-8 flex items-center justify-center gap-2 p-3 bg-[#f2e9eb]/50 rounded-lg border border-[#e5d2d7]">
        <Lock className="h-4 w-4 text-[#1a0f12]" aria-hidden="true" />
        <span className="text-sm font-medium text-[#1a0f12]">{t('securePaymentStripe')}</span>
      </div>

      {/* CTA Button */}
      <Button
        type="submit"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full mt-6 bg-primary hover:bg-[hsl(var(--primary-hover))] text-white h-14 rounded-lg font-bold text-lg shadow-lg shadow-primary/20 transition-all group"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
            {t('processing')}
          </>
        ) : (
          <>
            <span>{t('confirmAndPay', { amount: formatCHF(totalPrice) })}</span>
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
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
