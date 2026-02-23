import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { WineryProfileForm } from '@/components/features/winery/WineryProfileForm';
import { StripeOnboarding } from '@/components/features/winery/StripeOnboarding';
import { PaymentStatus } from '@/components/features/winery/PaymentStatus';
import { getPaymentStatusType } from '@/lib/utils/payment-status';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { VerifiedBadge } from '@/components/shared/VerifiedBadge';
import { generatePageMetadata } from '@/lib/seo/metadata';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generatePageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.dashboard.wineryProfile',
    noIndex: true,
  });
}

export default async function WineryProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  // Get winery with gallery images and status
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    include: {
      galleryImages: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!winery) {
    const locale = await getLocale();
    redirect(`/${locale}/onboarding/winery`);
  }

  const [t, tNav] = await Promise.all([
    getTranslations('winery'),
    getTranslations('nav'),
  ]);
  const isVerified = winery.status === 'VERIFIED';

  return (
    <WineryAccessGuard>
      <div className="container max-w-4xl py-12">
        {/* Breadcrumb */}
        <Breadcrumb
          className="mb-6"
          items={[
            { label: tNav('dashboard'), href: '/dashboard' },
            { label: tNav('wineryProfile') },
          ]}
        />

        {/* Premium Page Header */}
        <div className="mb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-display-md text-slate-900">
                  {winery.name}
                </h1>
                {isVerified && <VerifiedBadge size="md" />}
              </div>
              <p className="text-slate-600">
                {t('manageProfile')}
              </p>
              {winery.updatedAt && (
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {t('lastUpdatedDate', { date: formatDate(new Date(winery.updatedAt), locale as Locale) })}
                </p>
              )}
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link
                href={`/wineries/${winery.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                {t('viewPublicProfile')}
              </Link>
            </Button>
          </div>
        </div>

        {/* Payment Status Section */}
        {isVerified && (
          <div className="mb-8">
            {!winery.stripeAccountId ? (
              <StripeOnboarding wineryId={winery.id} />
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-slate-700">
                  {t('paymentStatusLabel')}
                </h2>
                <PaymentStatus
                  status={getPaymentStatusType({
                    stripeAccountId: winery.stripeAccountId,
                    stripeOnboardingComplete: winery.stripeOnboardingComplete,
                    stripeDetailsSubmitted: winery.stripeDetailsSubmitted,
                  })}
                />
              </div>
            )}
          </div>
        )}

        <WineryProfileForm
          winery={{
            id: winery.id,
            name: winery.name,
            slug: winery.slug,
            description: winery.description,
            address: winery.address,
            commune: winery.commune,
            phone: winery.phone,
            coverPhoto: winery.coverPhoto,
            galleryImages: winery.galleryImages,
          }}
        />
      </div>
    </WineryAccessGuard>
  );
}
