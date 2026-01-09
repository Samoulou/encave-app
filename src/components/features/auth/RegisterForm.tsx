'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wine } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@/lib/validators/auth';
import { registerAction, loginAction } from '@/server/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthPageLayout } from './AuthPageLayout';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      isWinemaker: false,
    },
  });

  const isWinemaker = form.watch('isWinemaker');

  async function onSubmit(data: RegisterInput) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await registerAction(data);

      if (result.success) {
        // Auto-login after registration
        const loginResult = await loginAction(data.email, data.password);
        if (loginResult.success) {
          // Redirect winemakers to onboarding, others to home
          if (data.isWinemaker) {
            router.push('/onboarding/winery');
          } else {
            router.push('/');
          }
          router.refresh();
        } else {
          // Registration succeeded but login failed, redirect to login
          router.push('/login');
        }
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
    <AuthPageLayout
      imageUrl="https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?q=80&w=1920&auto=format&fit=crop"
      imageAlt="Wine cellar with oak barrels"
      quote="Every great wine begins with passion. Join our community of exceptional winemakers."
    >
      {/* Heading */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-slate-900">
          Create an account
        </h1>
        <p className="mt-2 text-slate-600">
          Join EnCave and discover exceptional wine experiences
        </p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Your name"
                    autoComplete="name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <p className="mt-1.5 text-xs text-slate-500">
                  At least 8 characters with one number
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Winemaker checkbox with dashed border and visual feedback */}
          <FormField
            control={form.control}
            name="isWinemaker"
            render={({ field }) => (
              <FormItem
                className={cn(
                  'flex flex-row items-start space-x-3 space-y-0 rounded-lg border-2 border-dashed p-4 transition-all duration-200',
                  isWinemaker
                    ? 'border-burgundy-400 bg-burgundy-50'
                    : 'border-stone-300 hover:border-stone-400'
                )}
              >
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="flex cursor-pointer items-center gap-2">
                    <Wine className="h-4 w-4 text-burgundy-600" />
                    I am a winemaker
                  </FormLabel>
                  <p className="text-sm text-slate-500">
                    Check this if you want to register your winery and offer
                    experiences
                  </p>
                </div>
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>

          <p className="text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-burgundy-600 hover:text-burgundy-800 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-gold-400 after:transition-all hover:after:w-full"
            >
              Sign in
            </Link>
          </p>
        </form>
      </Form>
    </AuthPageLayout>
  );
}
