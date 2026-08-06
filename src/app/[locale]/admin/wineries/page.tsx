import { Search } from 'lucide-react';
import { WineryStatus } from '@prisma/client';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getWineriesForAdmin } from '@/server/queries/admin-wineries.queries';
import { formatDateShort } from '@/lib/i18n/formatters';
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

const STATUS_VARIANT: Record<
  WineryStatus,
  'success' | 'destructive' | 'warning' | 'secondary'
> = {
  VERIFIED: 'success',
  REJECTED: 'destructive',
  SUSPENDED: 'warning',
  PENDING: 'secondary',
};

interface AdminWineriesPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: WineryStatus | 'ALL' }>;
}

export default async function AdminWineriesPage({
  params,
  searchParams,
}: AdminWineriesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const filters = await searchParams;
  const q = filters.q?.trim() ?? '';
  const status =
    filters.status && filters.status !== 'ALL' ? filters.status : undefined;

  const [t, wineries] = await Promise.all([
    getTranslations('admin'),
    getWineriesForAdmin({ q, status }),
  ]);

  const statusLabel: Record<WineryStatus, string> = {
    PENDING: t('pendingReview'),
    VERIFIED: t('verified'),
    REJECTED: t('rejected'),
    SUSPENDED: t('wineriesList.suspended'),
  };

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-display-md text-burgundy-700">
          {t('wineriesList.title')}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t('wineriesList.subtitle')}
        </p>
      </div>

      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle>{t('wineriesList.filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder={t('wineriesList.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <select
              name="status"
              defaultValue={status ?? 'ALL'}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">{t('wineriesList.allStatuses')}</option>
              {Object.values(WineryStatus).map((value) => (
                <option key={value} value={value}>
                  {statusLabel[value]}
                </option>
              ))}
            </select>
            <Button type="submit">{t('wineriesList.filter')}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-warm">
        <CardContent className="p-0">
          {wineries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {t('wineriesList.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-4">{t('wineryName')}</th>
                    <th className="px-6 py-4">{t('applicant')}</th>
                    <th className="px-6 py-4">{t('wineriesList.plan')}</th>
                    <th className="px-6 py-4">{t('wineriesList.status')}</th>
                    <th className="px-6 py-4">{t('submitted')}</th>
                    <th className="px-6 py-4">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {wineries.map((winery) => (
                    <tr key={winery.id} className="align-top">
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">
                          {winery.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {winery.commune}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-foreground">
                          {winery.contactEmail}
                        </p>
                        {winery.ownerSuspended && (
                          <Badge variant="warning">
                            {t('wineriesList.ownerSuspended')}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {winery.plan}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={STATUS_VARIANT[winery.status]}>
                          {statusLabel[winery.status]}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDateShort(
                          new Date(winery.createdAt),
                          locale as Locale
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/wineries/${winery.id}`}>
                          <Button variant="outline" size="sm">
                            {t('review')}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
