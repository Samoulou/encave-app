import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { syncStripeAccountStatus } from '@/server/services/payment.service';
import { StripeCallbackResult } from '@/components/features/winery/StripeCallbackResult';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.stripe',
    noIndex: true,
  });
}

interface PageProps {
  searchParams: Promise<{ success?: string; refresh?: string }>;
}

export default async function StripeCallbackPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;
  const isRefresh = params.refresh === 'true';

  // Get winery
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      stripeAccountId: true,
      stripeOnboardingComplete: true,
      stripeDetailsSubmitted: true,
    },
  });

  if (!winery?.stripeAccountId) {
    redirect('/dashboard');
  }

  // Sync status from Stripe
  await syncStripeAccountStatus(winery.stripeAccountId);

  // Get updated status
  const updatedWinery = await db.winery.findUnique({
    where: { id: winery.id },
    select: {
      stripeOnboardingComplete: true,
      stripeDetailsSubmitted: true,
    },
  });

  const status = updatedWinery?.stripeOnboardingComplete
    ? 'complete'
    : updatedWinery?.stripeDetailsSubmitted
      ? 'pending'
      : 'incomplete';

  return (
    <div className="mx-auto max-w-lg py-12">
      <StripeCallbackResult
        status={status}
        isRefresh={isRefresh}
        wineryId={winery.id}
      />
    </div>
  );
}
