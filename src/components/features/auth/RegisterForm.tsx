'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { registerSchema, type RegisterInput } from '@/lib/validators/auth';
import { signUp, signIn } from '@/lib/auth-client';
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
import { cn } from '@/lib/utils';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.register');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Pre-check winemaker if coming from "Become Partner" link
  const isWinemakerFromUrl = searchParams.get('winemaker') === 'true';

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      isWinemaker: isWinemakerFromUrl,
    },
  });

  const isWinemaker = form.watch('isWinemaker');

  async function onSubmit(data: RegisterInput) {
    setIsLoading(true);
    setError(null);

    try {
      // Use Better Auth client to sign up
      const result = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
      });

      if (result.error) {
        // Handle Better Auth errors
        if (result.error.code === 'USER_ALREADY_EXISTS') {
          setError(t('emailExists'));
        } else {
          setError(result.error.message || tCommon('errors.somethingWentWrong'));
        }
        return;
      }

      // Auto-login after registration
      const loginResult = await signIn.email({
        email: data.email,
        password: data.password,
      });

      if (loginResult.error) {
        // Registration succeeded but login failed, redirect to login
        router.push('/login');
        return;
      }

      // Redirect winemakers to onboarding, clients to dashboard
      if (data.isWinemaker) {
        router.push('/onboarding/winery');
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch (err) {
      console.error('Registration error:', err);
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthPageLayout
      imageUrl="https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?q=80&w=1920&auto=format&fit=crop"
      imageAlt={t('imageAlt')}
      heroTitle={t('heroTitle')}
      heroSubtitle={t('heroSubtitle')}
    >
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 font-display">
          {t('title')}
        </h1>
        <p className="text-[#915564]">
          {t('subtitle')}
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
                <FormLabel>{tCommon('labels.name')}</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder={tCommon('placeholders.name')}
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
                <FormLabel>{tCommon('labels.email')}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder={tCommon('placeholders.email')}
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
                <FormLabel>{tCommon('labels.password')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t('passwordPlaceholder')}
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <p className="mt-1.5 text-xs text-slate-500">
                  {t('passwordHint')}
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
                <FormLabel>{t('confirmPassword')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t('confirmPasswordPlaceholder')}
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
                    <Wine className="h-4 w-4 text-burgundy-600" aria-hidden="true" />
                    {t('iAmWinemaker')}
                  </FormLabel>
                  <p className="text-sm text-slate-500">
                    {t('winemakerDescription')}
                  </p>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
            loadingText={t('creatingAccount')}
          >
            {t('createAccount')}
          </Button>

          <p className="text-center text-sm text-slate-600">
            {t('haveAccount')}{' '}
            <Link
              href="/login"
              className="font-medium text-burgundy-600 hover:text-burgundy-800 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-gold-400 after:transition-all hover:after:w-full"
            >
              {tCommon('buttons.signIn')}
            </Link>
          </p>
        </form>
      </Form>
    </AuthPageLayout>
  );
}
