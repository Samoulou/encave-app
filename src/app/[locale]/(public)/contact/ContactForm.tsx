'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { contactSchema, type ContactInput } from '@/lib/validators/contact';
import { sendContactMessageAction } from '@/server/actions/contact';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function ContactForm() {
  const t = useTranslations('contact.form');
  const locale = useLocale() as 'fr' | 'de' | 'en';
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
      website: '',
    },
  });

  const onSubmit = (data: ContactInput) => {
    setFormError(null);
    startTransition(async () => {
      const result = await sendContactMessageAction({ ...data, locale });
      if (result.success) {
        setSubmitted(true);
        reset();
      } else {
        setFormError(t('errorGeneric'));
      }
    });
  };

  if (submitted) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-xl border border-vine/30 bg-vine/5 p-8 text-center"
        role="status"
      >
        <CheckCircle2 className="h-10 w-10 text-vine" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold text-ink-900">
          {t('successTitle')}
        </h2>
        <p className="text-ink-600 text-sm">{t('successBody')}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 rounded-xl border border-stone-200 bg-white p-6 shadow-warm sm:p-8"
      noValidate
    >
      {/* Honeypot — hidden from users, catches bots. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          {...register('website')}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t('name')}</Label>
          <Input
            id="name"
            placeholder={t('namePlaceholder')}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm text-red-700">{t('nameError')}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-red-700">{t('emailError')}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="subject">{t('subject')}</Label>
        <Input
          id="subject"
          placeholder={t('subjectPlaceholder')}
          {...register('subject')}
        />
        {errors.subject && (
          <p className="text-sm text-red-700">{t('subjectError')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">{t('message')}</Label>
        <Textarea
          id="message"
          rows={6}
          placeholder={t('messagePlaceholder')}
          {...register('message')}
        />
        {errors.message && (
          <p className="text-sm text-red-700">{t('messageError')}</p>
        )}
      </div>

      {formError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('submitting')}
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {t('submit')}
          </>
        )}
      </Button>
    </form>
  );
}
