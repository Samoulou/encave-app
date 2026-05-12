import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Clock, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SuccessCheckmark } from '@/components/shared/SuccessCheckmark';
import { AnimatedProgressBar } from '@/components/shared/AnimatedProgressBar';
import { getTranslations } from 'next-intl/server';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.onboarding.confirmation',
    noIndex: true,
  });
}

export default async function WineryConfirmationPage() {
  const session = await auth();

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  // Get the user's winery
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
  });

  const locale = await getLocale();

  if (!winery) {
    redirect(`/${locale}/onboarding/winery`);
  }

  // If already verified, redirect to dashboard
  if (winery.status === 'VERIFIED') {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations('winery.onboarding');

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Progress bar - complete */}
      <div className="sticky top-0 z-10 border-b border-stone-200/60 bg-white/90 backdrop-blur-sm">
        <AnimatedProgressBar progress={100} />
      </div>

      <div className="mx-auto max-w-xl px-6 py-12 lg:py-16">
        {/* Success checkmark with glow */}
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <SuccessCheckmark size="md" />
          </div>

          <h1 className="font-display text-display-md text-slate-900">
            {t('congratulations')}
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            {t.rich('submittedForVerification', {
              name: winery.name,
              strong: (chunks: React.ReactNode) => (
                <strong className="text-burgundy-700">{chunks}</strong>
              ),
            })}
          </p>
        </div>

        {/* Timeline */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-warm">
          <h2 className="mb-5 font-semibold text-slate-900">
            {t('whatHappensNext')}
          </h2>
          <ol className="space-y-4">
            <li className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-burgundy-600 text-sm font-semibold text-white">
                1
              </div>
              <div className="pt-0.5">
                <p className="font-medium text-slate-900">{t('step1Title')}</p>
                <p className="text-sm text-slate-500">
                  {t('step1Description')}
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-burgundy-200 text-sm font-semibold text-burgundy-700">
                2
              </div>
              <div className="pt-0.5">
                <p className="font-medium text-slate-900">{t('step2Title')}</p>
                <p className="text-sm text-slate-500">
                  {t('step2Description')}
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-sm font-semibold text-slate-600">
                3
              </div>
              <div className="pt-0.5">
                <p className="font-medium text-slate-900">{t('step3Title')}</p>
                <p className="text-sm text-slate-500">
                  {t('step3Description')}
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* Email confirmation callout */}
        <div className="mb-8 rounded-xl border-2 border-gold-300 bg-gradient-to-r from-gold-50 to-gold-100/50 p-5">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400">
              <Mail className="h-5 w-5 text-gold-950" />
            </div>
            <div>
              <p className="font-medium text-gold-900">{t('checkInbox')}</p>
              <p className="text-sm text-gold-800">
                {t.rich('confirmationEmailSent', {
                  email: session.user.email,
                  strong: (chunks: React.ReactNode) => (
                    <strong>{chunks}</strong>
                  ),
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Expected timeline */}
        <div className="mb-8 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Clock className="h-4 w-4" />
          <span>
            {t.rich('expectedResponse', {
              hours: '48',
              strong: (chunks: React.ReactNode) => (
                <strong className="text-slate-700">{chunks}</strong>
              ),
            })}
          </span>
        </div>

        {/* Return button */}
        <Button asChild className="w-full">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2"
          >
            {t('returnToHomepage')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
