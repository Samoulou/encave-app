import { SlidersHorizontal, Users } from 'lucide-react';
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
import { SectionHeader } from './SectionHeader';

interface DetailsSectionProps {
  form: UseFormReturn<CreateExperienceInput>;
  sectionRef: (el: HTMLElement | null) => void;
}

export function DetailsSection({ form, sectionRef }: DetailsSectionProps) {
  return (
    <section
      ref={sectionRef}
      id="details"
      className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
    >
      <SectionHeader icon={SlidersHorizontal} title="Details" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Duration */}
        <FormField
          control={form.control}
          name="duration"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Duration
              </FormLabel>
              <FormControl>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  value={field.value?.toString()}
                >
                  <SelectTrigger className="bg-slate-50 border-stone-200 h-12">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
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
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Price per Person
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                    CHF
                  </span>
                  <Input
                    type="number"
                    placeholder="45.00"
                    className="bg-slate-50 border-stone-200 h-12 pl-12"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Max Capacity */}
        <FormField
          control={form.control}
          name="maxCapacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Max Capacity
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="12"
                    className="bg-slate-50 border-stone-200 h-12 pr-10"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                  />
                  <Users className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
