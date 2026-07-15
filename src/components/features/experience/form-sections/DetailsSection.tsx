import { SlidersHorizontal, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateExperienceInput } from '@/lib/validators/experience';
import { DURATION_OPTIONS } from '@/lib/validators/experience';
import { Input } from '@/components/ui/input';
import {
  FormControl,
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
import { Switch } from '@/components/ui/switch';
import { SectionHeader } from './SectionHeader';

interface DetailsSectionProps {
  form: UseFormReturn<CreateExperienceInput>;
  sectionRef: (_el: HTMLElement | null) => void;
  /** P-08: show the ONLINE / ON_SITE payment-mode picker (NO_SHOW_FEES flag). */
  showPaymentMode?: boolean;
  /** P-11: show the « Événement collectif » toggle (COLLECTIVE_EVENTS flag). */
  showCollective?: boolean;
}

export function DetailsSection({
  form,
  sectionRef,
  showPaymentMode = false,
  showCollective = false,
}: DetailsSectionProps) {
  const t = useTranslations('experience');

  return (
    <section
      ref={sectionRef}
      id="details"
      className="scroll-mt-24 rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
    >
      <SectionHeader icon={SlidersHorizontal} title={t('details')} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Duration */}
        <FormField
          control={form.control}
          name="duration"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('duration')}
              </FormLabel>
              <FormControl>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  value={field.value?.toString()}
                >
                  <SelectTrigger className="h-12 border-stone-200 bg-muted">
                    <SelectValue placeholder={t('selectDuration')} />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value.toString()}
                      >
                        {t(`durationOptions.${option.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Price */}
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('pricePerPersonLabel')}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    CHF
                  </span>
                  <Input
                    type="number"
                    placeholder="45.00"
                    className="h-12 border-stone-200 bg-muted pl-12"
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseFloat(e.target.value) || undefined)
                    }
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Payment mode (P-08 / L-070) — flag-gated */}
        {showPaymentMode && (
          <FormField
            control={form.control}
            name="paymentMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('paymentMode.label')}
                </FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? 'ONLINE'}
                  >
                    <SelectTrigger className="h-12 border-stone-200 bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ONLINE">
                        {t('paymentMode.online')}
                      </SelectItem>
                      <SelectItem value="ON_SITE">
                        {t('paymentMode.onSite')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Max Capacity */}
        <FormField
          control={form.control}
          name="maxCapacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('maxCapacityLabel')}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="12"
                    className="h-12 border-stone-200 bg-muted pr-10"
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 1)
                    }
                  />
                  <Users
                    className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Collective event (P-11 / L-100) — flag-gated. Participants are
          managed after creation, on the experience edit page. */}
      {showCollective && (
        <div className="mt-6 border-t border-stone-200 pt-6">
          <FormField
            control={form.control}
            name="isCollective"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border border-stone-200 p-4">
                <div className="space-y-0.5 pr-4">
                  <FormLabel className="text-sm font-semibold">
                    {t('collective.toggleLabel')}
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    {t('collective.toggleDescription')}
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                    aria-label={t('collective.toggleLabel')}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}
    </section>
  );
}
