import { notFound } from 'next/navigation';
import { Manrope, JetBrains_Mono, Fraunces } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import dynamic from 'next/dynamic';
import { Toaster } from '@/components/ui/sonner';
import { SkipLink } from '@/components/shared/SkipLink';
import { ProgressBarProvider } from '@/components/shared/ProgressBarProvider';
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

// L-206: reduced font matrix — 9 files instead of 18
// (Fraunces was 5 weights × 2 styles, Manrope 5 weights, Mono 3 weights).
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal'],
  variable: '--font-fraunces',
  display: 'swap',
});

// Fraunces italic is only used at regular weight (hero <em>, about quote) —
// load that single face via the `font-display-italic` utility instead of
// italics for every weight.
const frauncesItalic = Fraunces({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-fraunces-italic',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
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
      <head>
        {/* L-206: warm up connections to critical third-party origins */}
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="preconnect" href="https://api.stripe.com" />
        <link rel="dns-prefetch" href="https://eu.posthog.com" />
      </head>
      <body
        className={`${manrope.variable} ${fraunces.variable} ${frauncesItalic.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <PostHogProvider>
            <SkipLink />
            <NuqsAdapter>{children}</NuqsAdapter>
            <Toaster />
            <ProgressBarProvider />
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
