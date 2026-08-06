import {
  Wine,
  Compass,
  UtensilsCrossed,
  GraduationCap,
  Info,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateExperienceInput } from '@/lib/validators/experience';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { SectionHeader } from './SectionHeader';

const EXPERIENCE_TYPE_ICONS = {
  TASTING: Wine,
  VINEYARD_TOUR: Compass,
  FOOD_PAIRING: UtensilsCrossed,
  WORKSHOP: GraduationCap,
} as const;

const EXPERIENCE_TYPES = [
  { value: 'TASTING' as const },
  { value: 'VINEYARD_TOUR' as const },
  { value: 'FOOD_PAIRING' as const },
  { value: 'WORKSHOP' as const },
];

interface BasicInfoSectionProps {
  form: UseFormReturn<CreateExperienceInput>;
  sectionRef: (_el: HTMLElement | null) => void;
}

export function BasicInfoSection({ form, sectionRef }: BasicInfoSectionProps) {
  const t = useTranslations('experience');

  return (
    <section
      ref={sectionRef}
      id="general"
      className="scroll-mt-24 rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
    >
      <SectionHeader icon={Info} title={t('generalInfo')} />
      <div className="space-y-6">
        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('title')}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t('titlePlaceholder')}
                  className="h-auto rounded-lg border-stone-200 bg-muted px-4 py-3 focus:border-primary focus:ring-2 focus:ring-primary"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Experience Type - Radio Cards */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('experienceType')}
              </FormLabel>
              <FormControl>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {EXPERIENCE_TYPES.map((type) => {
                    const Icon = EXPERIENCE_TYPE_ICONS[type.value];
                    const isSelected = field.value === type.value;
                    return (
                      <label key={type.value} className="cursor-pointer">
                        <input
                          type="radio"
                          className="peer sr-only"
                          name="type"
                          value={type.value}
                          checked={isSelected}
                          onChange={() => field.onChange(type.value)}
                        />
                        <div
                          className={cn(
                            'rounded-lg border p-3 text-center transition-all',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-stone-200 bg-muted hover:bg-accent'
                          )}
                        >
                          <Icon
                            className="mx-auto mb-1 h-5 w-5"
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium">
                            {t(`types.${type.value}`)}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('description')}
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('descriptionPlaceholder')}
                  className="min-h-[140px] resize-none rounded-lg border-stone-200 bg-muted p-4 text-sm leading-relaxed focus:border-primary focus:ring-2 focus:ring-primary"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
