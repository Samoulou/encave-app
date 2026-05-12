'use client';

import { Control } from 'react-hook-form';
import type { WineryProfileInput } from '@/lib/validators/winery';
import { Textarea } from '@/components/ui/textarea';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useTranslations } from 'next-intl';

interface WineryBasicInfoSectionProps {
  control: Control<WineryProfileInput>;
}

// Section Header Component (shared)
function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-stone-200 pb-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-burgundy-100 text-burgundy-600">
        {icon}
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        )}
      </div>
    </div>
  );
}

export function WineryBasicInfoSection({
  control,
}: WineryBasicInfoSectionProps) {
  const t = useTranslations('winery');

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        }
        title={t('wineryInformation')}
        description={t('tellVisitors')}
      />

      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium">
              {t('description')}
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder={t('descriptionPlaceholder')}
                className="min-h-[180px] resize-none"
                {...field}
              />
            </FormControl>
            <FormDescription>{t('descriptionMinLength')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
