'use client';

import { User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  UseFormRegister,
  FieldErrors,
  FieldValues,
  Path,
} from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Generic props that work with any form containing contact fields
interface ContactDetailsSectionProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  isSubmitting: boolean;
}

export function ContactDetailsSection<T extends FieldValues>({
  register,
  errors,
  isSubmitting,
}: ContactDetailsSectionProps<T>) {
  const t = useTranslations('checkout');

  return (
    <section className="rounded-xl border border-border bg-white p-6 shadow-sm md:p-8">
      {/* Section Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-4 w-4" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-foreground">
          {t('contactDetails')}
        </h3>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* First Name */}
        <div className="flex flex-col">
          <Label
            htmlFor="firstName"
            className="pb-2 text-sm font-medium text-foreground"
          >
            {t('firstName')}
          </Label>
          <Input
            id="firstName"
            placeholder={t('firstNamePlaceholder')}
            autoComplete="given-name"
            disabled={isSubmitting}
            className="h-12 rounded-lg border-border bg-[#fbf9f9] placeholder:text-[#915564]/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
            {...register('firstName' as Path<T>)}
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-500">
              {String(errors.firstName.message)}
            </p>
          )}
        </div>

        {/* Last Name */}
        <div className="flex flex-col">
          <Label
            htmlFor="lastName"
            className="pb-2 text-sm font-medium text-foreground"
          >
            {t('lastName')}
          </Label>
          <Input
            id="lastName"
            placeholder={t('lastNamePlaceholder')}
            autoComplete="family-name"
            disabled={isSubmitting}
            className="h-12 rounded-lg border-border bg-[#fbf9f9] placeholder:text-[#915564]/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
            {...register('lastName' as Path<T>)}
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-500">
              {String(errors.lastName.message)}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col md:col-span-2">
          <Label
            htmlFor="email"
            className="pb-2 text-sm font-medium text-foreground"
          >
            {t('email')}
          </Label>
          <Input
            id="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            autoComplete="email"
            disabled={isSubmitting}
            className="h-12 rounded-lg border-border bg-[#fbf9f9] placeholder:text-[#915564]/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
            {...register('email' as Path<T>)}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">
              {String(errors.email.message)}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="flex flex-col md:col-span-2">
          <Label
            htmlFor="phone"
            className="pb-2 text-sm font-medium text-foreground"
          >
            {t('phone')}
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder={t('phonePlaceholder')}
            autoComplete="tel"
            disabled={isSubmitting}
            className="h-12 rounded-lg border-border bg-[#fbf9f9] placeholder:text-[#915564]/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
            {...register('phone' as Path<T>)}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-500">
              {String(errors.phone.message)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
