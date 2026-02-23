import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WineryAccessGuardProps {
  children: React.ReactNode;
}

/**
 * Server component that checks if the current user has a verified winery.
 * Renders children only if winery is verified, otherwise shows appropriate message.
 */
export async function WineryAccessGuard({ children }: WineryAccessGuardProps) {
  const t = await getTranslations('winery.accessGuard');
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Get winery directly from database (more reliable than JWT session role)
  const winery = await db.winery.findUnique({
    where: { userId: session.user.id },
    select: { status: true, name: true },
  });

  // Check if user has a winery
  if (!winery) {
    // Also check the database role in case JWT is stale
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'WINEMAKER') {
      return (
        <div className="container flex min-h-[60vh] items-center justify-center py-10">
          <Card className="mx-auto max-w-md text-center">
            <CardHeader>
              <CardTitle className="text-xl text-slate-700">
                {t('winemakerRequired')}
              </CardTitle>
              <CardDescription>
                {t('winemakerRequiredDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/onboarding/winery">{t('registerWinery')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // User has WINEMAKER role but no winery - redirect to onboarding
    redirect('/onboarding/winery');
  }

  // Handle different winery statuses
  switch (winery.status) {
    case 'PENDING':
      return (
        <div className="container flex min-h-[60vh] items-center justify-center py-10">
          <Card className="mx-auto max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <CardTitle className="text-xl text-slate-700">
                {t('verificationPending')}
              </CardTitle>
              <CardDescription>
                {t.rich('verificationPendingDescription', {
                  name: winery.name,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {t('verificationInfo')}
              </div>
              <Button asChild variant="outline">
                <Link href="/">{t('returnToHome')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );

    case 'REJECTED':
      return (
        <div className="container flex min-h-[60vh] items-center justify-center py-10">
          <Card className="mx-auto max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <CardTitle className="text-xl text-slate-700">
                {t('registrationNotApproved')}
              </CardTitle>
              <CardDescription>
                {t('registrationNotApprovedDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/">{t('returnToHome')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );

    case 'SUSPENDED':
      return (
        <div className="container flex min-h-[60vh] items-center justify-center py-10">
          <Card className="mx-auto max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <svg
                  className="h-6 w-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <CardTitle className="text-xl text-slate-700">
                {t('accountSuspended')}
              </CardTitle>
              <CardDescription>
                {t('accountSuspendedDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/">{t('returnToHome')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );

    case 'VERIFIED':
      // User has verified winery, render children
      return <>{children}</>;

    default:
      redirect('/onboarding/winery');
  }
}
