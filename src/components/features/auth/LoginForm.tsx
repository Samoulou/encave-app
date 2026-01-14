'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { loginAction } from '@/server/actions/auth';
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
import { AuthPageLayout } from './AuthPageLayout';
import Link from 'next/link';

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations('auth.login');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginAction(data.email, data.password);

      if (result.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(result.error.message);
      }
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthPageLayout
      imageUrl="https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1920&auto=format&fit=crop"
      imageAlt={t('imageAlt')}
      quote={t('quote')}
    >
      {/* Heading */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-slate-900">
          {t('title')}
        </h1>
        <p className="mt-2 text-slate-600">
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
                <div className="flex items-center justify-between">
                  <FormLabel>{tCommon('labels.password')}</FormLabel>
                  <a
                    href="mailto:support@encave.ch?subject=Password%20Reset%20Request"
                    className="text-sm text-burgundy-600 hover:text-burgundy-800 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-gold-400 after:transition-all hover:after:w-full"
                    title={t('forgotPasswordContactSupport')}
                  >
                    {t('forgotPassword')}
                  </a>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t('passwordPlaceholder')}
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
            loadingText={t('signingIn')}
          >
            {tCommon('buttons.signIn')}
          </Button>

          <p className="text-center text-sm text-slate-600">
            {t('noAccount')}{' '}
            <Link
              href="/register"
              className="inline-flex items-center font-medium text-burgundy-600 hover:text-burgundy-800 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-gold-400 after:transition-all hover:after:w-full"
            >
              {t('createOne')}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </p>
        </form>
      </Form>
    </AuthPageLayout>
  );
}
