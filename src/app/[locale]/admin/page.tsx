import { db } from '@/server/db';
import { getFeatureFlags } from '@/server/queries/feature-flags.queries';
import { getAdminBusinessKpis } from '@/server/queries/admin-metrics.queries';
import { AdminStats } from '@/components/features/admin/AdminStats';
import { AdminBusinessKpis } from '@/components/features/admin/AdminBusinessKpis';
import { FeatureFlagsPanel } from '@/components/features/admin/FeatureFlagsPanel';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  ClipboardList,
  ShieldCheck,
  ToggleRight,
  Wine,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
    namespace: 'metadata.admin',
    noIndex: true,
  });
}

async function getWineryStats() {
  const [pending, verified, rejected, total] = await Promise.all([
    db.winery.count({ where: { status: 'PENDING' } }),
    db.winery.count({ where: { status: 'VERIFIED' } }),
    db.winery.count({ where: { status: 'REJECTED' } }),
    db.winery.count(),
  ]);

  return { pending, verified, rejected, total };
}

async function getRecentPending() {
  return db.winery.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      user: {
        select: { email: true },
      },
    },
  });
}

export default async function AdminDashboard() {
  const [stats, recentPending, flags, kpis, t] = await Promise.all([
    getWineryStats(),
    getRecentPending(),
    getFeatureFlags(),
    getAdminBusinessKpis(),
    getTranslations('admin'),
  ]);

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-display-md text-burgundy-700">
          {t('title')}
        </h1>
        <p className="mt-2 text-slate-600">{t('subtitle')}</p>
      </div>

      <AdminStats {...stats} />

      <AdminBusinessKpis kpis={kpis} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent Pending Section */}
        <Card className="shadow-warm">
          <CardHeader className="border-b border-stone-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="font-display">
                    {t('recentPending')}
                  </CardTitle>
                  <CardDescription>
                    {t('recentPendingDescription')}
                  </CardDescription>
                </div>
              </div>
              {stats.pending > 0 && (
                <Link href="/admin/wineries/pending">
                  <Button variant="outline" size="sm">
                    {t('viewAll')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {recentPending.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <Wine className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm text-slate-500">
                  {t('noPendingWineries')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPending.map((winery) => (
                  <div
                    key={winery.id}
                    className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-4 transition-colors hover:border-burgundy-200 hover:bg-burgundy-50/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">
                        {winery.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                        <MapPin className="h-3.5 w-3.5" />
                        {winery.commune}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDistanceToNow(new Date(winery.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Link href={`/admin/wineries/${winery.id}`}>
                      <Button size="sm">{t('review')}</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Section */}
        <Card className="shadow-warm">
          <CardHeader className="border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-100">
                <ClipboardList className="h-5 w-5 text-burgundy-600" />
              </div>
              <div>
                <CardTitle className="font-display">
                  {t('quickActions')}
                </CardTitle>
                <CardDescription>
                  {t('quickActionsDescription')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <Link href="/admin/wineries/pending" className="block">
              <Button
                variant="outline"
                className="h-12 w-full justify-start hover:border-burgundy-300 hover:bg-burgundy-50"
              >
                <Clock className="mr-3 h-4 w-4 text-amber-500" />
                {t('reviewPendingWineries')}
                {stats.pending > 0 && (
                  <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-burgundy-600 px-2 text-xs font-semibold text-white">
                    {stats.pending}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/admin/events" className="block">
              <Button
                variant="outline"
                className="h-12 w-full justify-start hover:border-burgundy-300 hover:bg-burgundy-50"
              >
                <CalendarDays className="mr-3 h-4 w-4 text-burgundy-500" />
                Review events
              </Button>
            </Link>
            <Link href="/admin/bookings" className="block">
              <Button
                variant="outline"
                className="h-12 w-full justify-start hover:border-burgundy-300 hover:bg-burgundy-50"
              >
                <ClipboardList className="mr-3 h-4 w-4 text-burgundy-500" />
                Search bookings
              </Button>
            </Link>
            <Link href="/admin/compliance" className="block">
              <Button
                variant="outline"
                className="h-12 w-full justify-start hover:border-burgundy-300 hover:bg-burgundy-50"
              >
                <ShieldCheck className="mr-3 h-4 w-4 text-burgundy-500" />
                Compliance checklist
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Feature Flags Section (P-03 kill-switches) */}
        <Card className="shadow-warm">
          <CardHeader className="border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-100">
                <ToggleRight className="h-5 w-5 text-burgundy-600" />
              </div>
              <div>
                <CardTitle className="font-display">
                  {t('featureFlags.title')}
                </CardTitle>
                <CardDescription>
                  {t('featureFlags.description')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <FeatureFlagsPanel flags={flags} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
