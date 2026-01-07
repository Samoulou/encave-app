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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-burgundy-700">
          Register Your Winery
        </CardTitle>
        <CardDescription>
          Tell us about your winery to get started on EnCave
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

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
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Minimum 50 characters. Describe your winery, wines, and what
                    visitors can expect.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Submitting...' : 'Submit for Verification'}
            </Button>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}
