import {
  Wine,
  Compass,
  UtensilsCrossed,
  GraduationCap,
  Info,
} from 'lucide-react';
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
  { value: 'TASTING' as const, label: 'Tasting' },
  { value: 'VINEYARD_TOUR' as const, label: 'Tour' },
  { value: 'FOOD_PAIRING' as const, label: 'Dinner' },
  { value: 'WORKSHOP' as const, label: 'Class' },
];

interface BasicInfoSectionProps {
  form: UseFormReturn<CreateExperienceInput>;
  sectionRef: (_el: HTMLElement | null) => void;
}

export function BasicInfoSection({ form, sectionRef }: BasicInfoSectionProps) {
  return (
    <section
      ref={sectionRef}
      id="general"
      className="scroll-mt-24 rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:p-8"
    >
      <SectionHeader icon={Info} title="General Info" />
      <div className="space-y-6">
        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Experience Title
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Sunset Vineyard Tasting & Tour"
                  className="h-auto rounded-lg border-stone-200 bg-slate-50 px-4 py-3 focus:border-primary focus:ring-2 focus:ring-primary"
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
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Experience Type
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
                              ? 'border-primary bg-primary text-white'
                              : 'border-stone-200 bg-slate-50 hover:bg-slate-100'
                          )}
                        >
                          <Icon
                            className="mx-auto mb-1 h-5 w-5"
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium">
                            {type.label}
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
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Description
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the experience in detail. What can guests expect?"
                  className="min-h-[140px] resize-none rounded-lg border-stone-200 bg-slate-50 p-4 text-sm leading-relaxed focus:border-primary focus:ring-2 focus:ring-primary"
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
