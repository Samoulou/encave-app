'use client';

import { Control } from 'react-hook-form';
import type { WineryProfileInput } from '@/lib/validators/winery';
import { VALAIS_COMMUNES } from '@/lib/constants/communes';
import { Input } from '@/components/ui/input';
import {
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
import { useTranslations } from 'next-intl';

interface WineryContactSectionProps {
  control: Control<WineryProfileInput>;
}

export function WineryContactSection({ control }: WineryContactSectionProps) {
  const t = useTranslations('winery');

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-start gap-4 border-b border-stone-200 pb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-600">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {t('contactDetails')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('contactDetailsDescription')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="address"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel className="text-base font-medium">
                {t('address')}
              </FormLabel>
              <FormControl>
                <Input placeholder={t('addressPlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="commune"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-medium">
                {t('commune')}
              </FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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

        <FormField
          control={control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-medium">
                {t('contactPhone')}
              </FormLabel>
              <FormControl>
                <Input placeholder={t('phonePlaceholder')} {...field} />
              </FormControl>
              <FormDescription>{t('swissFormatShort')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
