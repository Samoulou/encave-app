import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import type { CreateExperienceInput } from '@/lib/validators/experience';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';

interface CollectiveEventToggleProps {
  form: UseFormReturn<CreateExperienceInput>;
}

/**
 * The « Événement collectif » toggle (P-11 / L-100), shared by the create
 * (DetailsSection) and edit (EditExperienceForm) forms so their wiring and
 * copy never drift. Each caller supplies its own section chrome; this owns
 * only the FormField + Switch.
 */
export function CollectiveEventToggle({ form }: CollectiveEventToggleProps) {
  const t = useTranslations('experience');
  return (
    <FormField
      control={form.control}
      name="isCollective"
      render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-xl border border-stone-200 p-4">
          <div className="space-y-0.5 pr-4">
            <FormLabel className="text-base font-medium">
              {t('collective.toggleLabel')}
            </FormLabel>
            <FormDescription>
              {t('collective.toggleDescription')}
            </FormDescription>
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
  );
}
