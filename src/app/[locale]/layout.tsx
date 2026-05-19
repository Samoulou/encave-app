import { notFound } from 'next/navigation';
import { Manrope, JetBrains_Mono, Fraunces } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import dynamic from 'next/dynamic';
import { Toaster } from '@/components/ui/sonner';
import { SkipLink } from '@/components/shared/SkipLink';
import { ProgressBarProvider } from '@/components/shared/ProgressBarProvider';
import { NavigationLoader } from '@/components/shared/NavigationLoader';
import { SentryUserSync } from '@/components/shared/SentryUserSync';
import { CookieConsentBanner } from '@/components/shared/CookieConsentBanner';
import {
  PostHogProvider,
  PostHogUserSync,
} from '@/components/shared/PostHogProvider';
import { routing, type Locale } from '@/i18n/routing';
import '../globals.css';

// Defer analytics loading until after hydration (bundle-defer-third-party)
const Analytics = dynamic(
  () => import('@/components/shared/Analytics').then((mod) => mod.Analytics),
  { ssr: false }
);

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client side
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head />
      <body
        className={`${manrope.variable} ${fraunces.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <PostHogProvider>
            <SkipLink />
            <NuqsAdapter>{children}</NuqsAdapter>
            <Toaster />
            <ProgressBarProvider />
            <NavigationLoader />
            <SentryUserSync />
            <PostHogUserSync />
            <CookieConsentBanner />
            <Analytics />
          </PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
