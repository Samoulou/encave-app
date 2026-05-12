'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AuthPageLayout } from './AuthPageLayout';
import { SocialLoginButtons } from './SocialLoginButtons';
import loginImage from '@/../public/images/login-image.jpg';

/**
 * Validate returnUrl to prevent open redirect attacks
 * Only allows same-origin relative paths
 */
function isValidReturnUrl(url: string): boolean {
  // Must start with / and not // (prevents protocol-relative URLs)
  if (!url.startsWith('/') || url.startsWith('//')) {
    return false;
  }
  try {
    // Parse as URL to check for any tricks
    const parsed = new URL(url, 'http://localhost');
    // Ensure it's a relative path (no host change)
    return parsed.host === 'localhost';
  } catch {
    return false;
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.login');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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
      // Use Better Auth client to sign in - this properly sets signed cookies
      const result = await signIn.email({
        email: data.email,
        password: data.password,
        rememberMe,
      });

      if (result.error) {
        // Handle Better Auth errors
        setError(result.error.message || t('invalidCredentials'));
        return;
      }

      // Check for callback URL (from middleware) or returnUrl parameter
      const callbackUrl =
        searchParams.get('callbackUrl') || searchParams.get('returnUrl');

      // Determine redirect destination
      let redirectPath: string;

      if (callbackUrl && isValidReturnUrl(callbackUrl)) {
        // Use callback URL if valid (for protected page access)
        redirectPath = callbackUrl;
      } else {
        // Default redirect - server will handle role-based redirect if needed
        // For now, redirect to home and let middleware handle protected routes
        redirectPath = '/';
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError(tCommon('errors.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthPageLayout
      imageUrl={loginImage}
      imageAlt={t('imageAlt')}
      heroTitle={t('heroTitle')}
      heroSubtitle={t('heroSubtitle')}
    >
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold text-slate-900">
          {t('title')}
        </h1>
        <p className="text-[#915564]">{t('subtitle')}</p>
      </div>

      {/* Form */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
        >
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel className="text-sm font-medium text-slate-900">
                  {tCommon('labels.email')}
                </FormLabel>
                <FormControl>
                  <div className="group relative">
                    <Input
                      type="email"
                      placeholder={tCommon('placeholders.email')}
                      autoComplete="email"
                      className="h-12 w-full rounded-lg border border-border bg-white px-4 pr-10 text-slate-900 transition-all placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      {...field}
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 transition-colors group-focus-within:text-primary">
                      <Mail className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-medium text-slate-900">
                    {tCommon('labels.password')}
                  </FormLabel>
                  <a
                    href="mailto:support@encave.ch?subject=Password%20Reset%20Request"
                    className="text-sm font-medium text-primary transition-all hover:text-primary/80 hover:underline"
                    title={t('forgotPasswordContactSupport')}
                  >
                    {t('forgotPassword')}
                  </a>
                </div>
                <FormControl>
                  <div className="group relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-12 w-full rounded-lg border border-border bg-white px-4 pr-10 text-slate-900 transition-all placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition-colors hover:text-slate-900"
                      aria-label={
                        showPassword ? t('hidePassword') : t('showPassword')
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Remember Me Checkbox */}
          <div className="flex items-center gap-3 py-1">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              className="border-slate-300 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
            />
            <label
              htmlFor="remember"
              className="cursor-pointer text-sm font-medium text-slate-900"
            >
              {t('rememberMe')}
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="mt-2 h-12 w-full rounded-lg bg-primary font-semibold text-white shadow-sm shadow-primary/30 transition-colors hover:bg-primary/90"
            isLoading={isLoading}
            loadingText={t('signingIn')}
          >
            {t('logIn')}
          </Button>

          {/* Social Login */}
          <SocialLoginButtons />

          {/* Sign Up Link */}
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-500">
              {t('noAccount')}{' '}
              <Link
                href="/register"
                className="font-semibold text-primary transition-all hover:text-primary/80 hover:underline"
              >
                {t('createAccount')}
              </Link>
            </p>
          </div>
        </form>
      </Form>
    </AuthPageLayout>
  );
}
