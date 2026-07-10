import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Landmark } from 'lucide-react';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { PayoutsList } from './PayoutsList';
import { StripeDashboardButton } from '@/components/features/payouts/StripeDashboardButton';
import { Skeleton, SkeletonContainer } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
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
    namespace: 'metadata.dashboard.payouts',
    noIndex: true,
  });
}

/**
 * « Reversements » (P-13 / L-141, ENC-114 MVP): real Stripe payout
 * history — date, translated status, net amount — with a per-payout
 * detail page. No custom table, no heuristic: Stripe is the source of
 * truth. Period filters + CSV export are consigned debt.
 */
export default async function PayoutsPage() {
  const session = await auth();
  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { stripeAccountId: true, stripeOnboardingComplete: true },
  });
  if (!winery) {
    const locale = await getLocale();
    redirect(`/${locale}/onboarding/winery`);
  }

  const t = await getTranslations('Payouts');

  return (
    <WineryAccessGuard>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
          {winery.stripeAccountId && <StripeDashboardButton />}
        </div>

        {!winery.stripeAccountId || !winery.stripeOnboardingComplete ? (
          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
            <Landmark
              className="mx-auto h-10 w-10 text-stone-400"
              aria-hidden="true"
            />
            <h2 className="mt-3 font-display text-lg font-semibold text-foreground">
              {t('empty.stripeNotReady.title')}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {t('empty.stripeNotReady.body')}
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/winery/profile">
                {t('empty.stripeNotReady.cta')}
              </Link>
            </Button>
          </div>
        ) : (
          <Suspense fallback={<PayoutsSkeleton />}>
            <PayoutsList stripeAccountId={winery.stripeAccountId} />
          </Suspense>
        )}
      </div>
    </WineryAccessGuard>
  );
}

async function PayoutsSkeleton() {
  const t = await getTranslations('Payouts');
  return (
    <SkeletonContainer label={t('loading')} className="space-y-3">
      <Skeleton className="h-24 w-full rounded-xl" />
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </SkeletonContainer>
  );
}
