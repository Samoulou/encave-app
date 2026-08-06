'use client';

import { Control } from 'react-hook-form';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WineryProfileInput } from '@/lib/validators/winery';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface WineryDomaineDetailsSectionProps {
  control: Control<WineryProfileInput>;
}

/**
 * P-12 / L-117 — public-fiche enrichment for the domaine: opening hours (Must)
 * and the identity chips (family, altitude, hectares, signature grapes —
 * Should). All optional; blank fields are simply not rendered on the fiche.
 */
export function WineryDomaineDetailsSection({
  control,
}: WineryDomaineDetailsSectionProps) {
  const t = useTranslations('winery.domaineDetails');

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-start gap-4 border-b border-stone-200 pb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-600">
          <Clock className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      <FormField
        control={control}
        name="openingHours"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium">
              {t('openingHours')}
            </FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                placeholder={t('openingHoursPlaceholder')}
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormDescription>{t('openingHoursHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={control}
          name="familyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-medium">
                {t('familyName')}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t('familyNamePlaceholder')}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="signatureGrapes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-medium">
                {t('signatureGrapes')}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t('signatureGrapesPlaceholder')}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>{t('signatureGrapesHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="altitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-medium">
                {t('altitude')}
              </FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  placeholder={t('altitudePlaceholder')}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>{t('altitudeHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="hectares"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-medium">
                {t('hectares')}
              </FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder={t('hectaresPlaceholder')}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>{t('hectaresHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
