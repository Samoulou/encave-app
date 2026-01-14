'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CreditCard, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBookingAndCheckout } from '@/server/actions/checkout';

// Phone validation - accepts Swiss and international formats
const phoneRegex = /^(\+41|0041|0)?[1-9][0-9]{8}$|^\+?[1-9]\d{6,14}$/;

const checkoutFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
});

type CheckoutFormData = z.infer<typeof checkoutFormSchema>;

interface CheckoutFormProps {
  experienceId: string;
  wineryId: string;
  date: string;
  time: string;
  guestCount: number;
  totalPrice: number;
}

export function CheckoutForm({
  experienceId,
  wineryId,
  date,
  time,
  guestCount,
  totalPrice,
}: CheckoutFormProps) {
  const t = useTranslations('checkout');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema),
  });

  const onSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createBookingAndCheckout({
        experienceId,
        wineryId,
        date,
        timeSlot: time,
        guestCount,
        visitorName: data.name,
        visitorEmail: data.email,
        visitorPhone: data.phone.replace(/\s/g, ''), // Remove spaces from phone
      });

      if (result.success) {
        // Redirect to Stripe Checkout
        router.push(result.data.checkoutUrl);
      } else {
        setError(result.error.message);
        setIsSubmitting(false);
      }
    } catch {
      setError(tErrors('somethingWentWrong'));
      setIsSubmitting(false);
    }
  };

  const formatPrice = (priceInCents: number) => {
    return `CHF ${(priceInCents / 100).toFixed(0)}`;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">{t('name')}</Label>
        <Input
          id="name"
          placeholder={t('namePlaceholder')}
          autoComplete="name"
          {...register('name')}
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          {...register('email')}
          disabled={isSubmitting}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
        <p className="text-xs text-slate-500">{t('emailHelp')}</p>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input
          id="phone"
          type="tel"
          placeholder={t('phonePlaceholder')}
          autoComplete="tel"
          {...register('phone')}
          disabled={isSubmitting}
        />
        {errors.phone && (
          <p className="text-sm text-red-500">{errors.phone.message}</p>
        )}
        <p className="text-xs text-slate-500">{t('phoneHelp')}</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Security note */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Lock className="h-4 w-4" />
        <span>{t('securePayment')}</span>
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('processing')}
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-5 w-5" />
            {t('payAmount', { amount: formatPrice(totalPrice) })}
          </>
        )}
      </Button>
    </form>
  );
}
