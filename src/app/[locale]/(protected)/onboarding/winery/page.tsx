import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Wine } from 'lucide-react';
import { WineryOnboardingForm } from '@/components/features/winery/WineryOnboardingForm';
import { AnimatedProgressBar } from '@/components/shared/AnimatedProgressBar';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.onboarding',
    noIndex: true,
  });
}

export default async function WineryOnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  // Check if user already has a winery
  const existingWinery = await db.winery.findUnique({
    where: { userId: session.user.id },
  });

  if (existingWinery) {
    const locale = await getLocale();
    // Redirect based on winery status
    if (existingWinery.status === 'PENDING') {
      redirect(`/${locale}/onboarding/winery/confirmation`);
    } else if (existingWinery.status === 'VERIFIED') {
      redirect(`/${locale}/dashboard`);
    }
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-stone-200/60">
        <AnimatedProgressBar progress={50} />
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8 lg:py-12">
        {/* Header with back link and step indicator */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-burgundy-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="text-sm font-medium text-slate-500">Step 1 of 2</span>
        </div>

        {/* Hero section */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-burgundy-100">
            <Wine className="h-8 w-8 text-burgundy-600" />
          </div>
          <h1 className="font-display text-display-md text-slate-900">
            Register Your Winery
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Tell us about your winery to get started on EnCave and connect with wine enthusiasts.
          </p>
        </div>

        {/* Form */}
        <WineryOnboardingForm />
      </div>
    </div>
  );
}
