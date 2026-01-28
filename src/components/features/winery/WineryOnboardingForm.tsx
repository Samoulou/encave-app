'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  wineryOnboardingSchema,
  type WineryOnboardingInput,
} from '@/lib/validators/winery';
import { VALAIS_COMMUNES } from '@/lib/constants/communes';
import { createWinery } from '@/server/actions/winery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const MAX_DESCRIPTION_LENGTH = 500;
const MIN_DESCRIPTION_LENGTH = 50;

export function WineryOnboardingForm() {
  const router = useRouter();
  const t = useTranslations('winery');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<WineryOnboardingInput>({
    resolver: zodResolver(wineryOnboardingSchema),
    defaultValues: {
      name: '',
      description: '',
      address: '',
      commune: '',
      phone: '',
    },
  });

  const descriptionValue = form.watch('description') || '';
  const descriptionLength = descriptionValue.length;

  async function onSubmit(data: WineryOnboardingInput) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await createWinery(data);

      if (result.success) {
        router.push('/onboarding/winery/confirmation');
        router.refresh();
      } else {
        setError(result.error.message);
      }
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Section: Winery Information */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 rounded-lg bg-burgundy-50 px-4 py-3">
            <span className="text-xl">🍷</span>
            <h2 className="font-semibold text-burgundy-900">{t('wineryInformation')}</h2>
          </div>

          <div className="space-y-6 pl-1">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('wineryName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('wineryNamePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('descriptionPlaceholder')}
                      className="min-h-[140px] resize-none"
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      {...field}
                    />
                  </FormControl>
                  <div className="flex items-center justify-between">
                    <FormDescription>
                      {t('descriptionHelp')}
                    </FormDescription>
                    <span
                      className={cn(
                        'text-xs font-medium tabular-nums',
                        descriptionLength < MIN_DESCRIPTION_LENGTH
                          ? 'text-amber-600'
                          : descriptionLength > MAX_DESCRIPTION_LENGTH - 50
                            ? 'text-red-500'
                            : 'text-slate-400'
                      )}
                    >
                      {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-stone-200" />

        {/* Section: Location */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 rounded-lg bg-gold-50 px-4 py-3">
            <span className="text-xl">📍</span>
            <h2 className="font-semibold text-gold-900">{t('location')}</h2>
          </div>

          <div className="space-y-6 pl-1">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('address')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('addressPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="commune"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('commune')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('communePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VALAIS_COMMUNES.map((commune) => (
                        <SelectItem key={commune} value={commune}>
                          {commune}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-stone-200" />

        {/* Section: Contact */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3">
            <span className="text-xl">📞</span>
            <h2 className="font-semibold text-slate-900">{t('contact')}</h2>
          </div>

          <div className="space-y-6 pl-1">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('contactPhone')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('phonePlaceholder')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('phoneHelp')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* Submit button */}
        <div className="pt-4">
          <Button
            type="submit"
            className="w-full sm:w-auto sm:min-w-[200px] sm:mx-auto sm:block"
            isLoading={isLoading}
            loadingText={t('submitting')}
          >
            {t('continue')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
