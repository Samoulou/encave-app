import { Wine, Compass, UtensilsCrossed, GraduationCap, Info } from 'lucide-react';
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
      className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
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
                  className="bg-slate-50 border-stone-200 rounded-lg px-4 py-3 h-auto focus:ring-2 focus:ring-primary focus:border-primary"
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                            'border rounded-lg p-3 text-center transition-all',
                            isSelected
                              ? 'bg-primary text-white border-primary'
                              : 'border-stone-200 bg-slate-50 hover:bg-slate-100'
                          )}
                        >
                          <Icon className="h-5 w-5 mx-auto mb-1" aria-hidden="true" />
                          <span className="text-sm font-medium">{type.label}</span>
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
                <div className="border border-stone-200 rounded-lg bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  {/* Rich Text Toolbar */}
                  <div className="flex items-center gap-1 border-b border-stone-200 p-2 bg-white">
                    <button
                      type="button"
                      className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      aria-label="Bold"
                    >
                      <span className="font-bold text-sm" aria-hidden="true">B</span>
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      aria-label="Italic"
                    >
                      <span className="italic text-sm" aria-hidden="true">I</span>
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      aria-label="Underline"
                    >
                      <span className="underline text-sm" aria-hidden="true">U</span>
                    </button>
                    <div className="w-px h-4 bg-stone-300 mx-1" aria-hidden="true" />
                    <button
                      type="button"
                      className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      aria-label="Bullet list"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </div>
                  <Textarea
                    placeholder="Describe the experience in detail. What can guests expect?"
                    className="w-full bg-transparent border-none p-4 min-h-[140px] outline-none text-sm leading-relaxed resize-none focus-visible:ring-0"
                    {...field}
                  />
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
