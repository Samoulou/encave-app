import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { QrCode } from 'lucide-react';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { VisibilityBanner } from '@/components/features/dashboard/VisibilityBanner';
import { VisibilityBannerSkeleton } from '@/components/features/dashboard/VisibilityBannerSkeleton';
import { TastingSheetAlertBanner } from '@/components/features/wine/TastingSheetAlertBanner';
import { StripeKycBanner } from '@/components/features/dashboard/StripeKycBanner';
import { TodayKpis } from '@/components/features/dashboard/today/TodayKpis';
import { UpcomingSessionsCard } from '@/components/features/dashboard/today/UpcomingSessionsCard';
import { ScanFab } from '@/components/features/dashboard/today/ScanFab';
import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';
import { formatDate } from '@/lib/i18n/formatters';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';
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
    path: '/dashboard',
    namespace: 'metadata.dashboard',
    noIndex: true,
  });
}

/**
 * « Aujourd'hui » — the winemaker landing (P-13 / L-130): honest KPIs,
 * actionable alert stack (visibility, empty tasting sheet, Stripe KYC),
 * next sessions with seat gauges, and the scan entry point. CLIENT keeps
 * its historical redirect to my-bookings.
 */
export default async function DashboardTodayPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }
  if (session.user.role === 'CLIENT') {
    redirect(`/${locale}/dashboard/my-bookings`);
  }
  if (session.user.role !== 'WINEMAKER') {
    redirect(`/${locale}`);
  }

  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { id: true, stripeOnboardingComplete: true },
  });
  if (!winery) {
    redirect(`/${locale}/onboarding/winery`);
  }

  const t = await getTranslations('Dashboard.today');
  const todayLabel = formatDate(
    zurichTodayAsUTCDate(new Date()),
    locale as Locale,
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }
  );

  return (
    <WineryAccessGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm capitalize text-muted-foreground">
              {todayLabel}
            </p>
          </div>
          <Button asChild className="hidden md:inline-flex">
            <Link href="/dashboard/scan">
              <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('scanButton')}
            </Link>
          </Button>
        </div>

        {/* Actionable alerts — KYC renders immediately (no query) */}
        <StripeKycBanner
          stripeOnboardingComplete={winery.stripeOnboardingComplete}
        />
        <Suspense fallback={<VisibilityBannerSkeleton />}>
          <VisibilityBanner wineryId={winery.id} />
        </Suspense>
        <Suspense fallback={null}>
          <TastingSheetAlertBanner userId={session.user.id} />
        </Suspense>

        {/* KPIs */}
        <Suspense fallback={<KpisSkeleton />}>
          <TodayKpis userId={session.user.id} wineryId={winery.id} />
        </Suspense>

        {/* Next sessions with gauges */}
        <Suspense fallback={<UpcomingSkeleton />}>
          <UpcomingSessionsCard userId={session.user.id} />
        </Suspense>

        <ScanFab />
      </div>
    </WineryAccessGuard>
  );
}

async function KpisSkeleton() {
  const t = await getTranslations('Dashboard.today');
  return (
    <SkeletonContainer
      label={t('loading')}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl" />
      ))}
    </SkeletonContainer>
  );
}

async function UpcomingSkeleton() {
  const t = await getTranslations('Dashboard.today');
  return (
    <SkeletonContainer label={t('loading')}>
      <Skeleton className="h-64 w-full rounded-xl" />
    </SkeletonContainer>
  );
}
