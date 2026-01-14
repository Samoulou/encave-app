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

const MAX_DESCRIPTION_LENGTH = 500;
const MIN_DESCRIPTION_LENGTH = 50;

export function WineryOnboardingForm() {
  const router = useRouter();
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
      setError('Something went wrong. Please try again.');
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
            <h2 className="font-semibold text-burgundy-900">Winery Information</h2>
          </div>

          <div className="space-y-6 pl-1">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Winery Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Domaine des Vignes" {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell visitors about your winery, your history, and what makes your wines special..."
                      className="min-h-[140px] resize-none"
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      {...field}
                    />
                  </FormControl>
                  <div className="flex items-center justify-between">
                    <FormDescription>
                      Describe your winery, wines, and what visitors can expect.
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
            <h2 className="font-semibold text-gold-900">Location</h2>
          </div>

          <div className="space-y-6 pl-1">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Rue du Vignoble 12" {...field} />
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
                  <FormLabel>Commune</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your commune" />
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
            <h2 className="font-semibold text-slate-900">Contact</h2>
          </div>

          <div className="space-y-6 pl-1">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+41 27 123 45 67" {...field} />
                  </FormControl>
                  <FormDescription>
                    Swiss phone format: +41 XX XXX XX XX or 0XX XXX XX XX
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
            loadingText="Submitting..."
          >
            Continue
          </Button>
        </div>
      </form>
    </Form>
  );
}
