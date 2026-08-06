import { getTranslations } from 'next-intl/server';
import { Search } from 'lucide-react';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import { Link } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EXPERIENCE_TYPE_OPTIONS } from '@/lib/validators/experience';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { COLLECTIVE_SOLD_STATUSES } from '@/lib/business-rules/collective-events';
import { generatePageMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/routing';
import type { ExperienceStatus, ExperienceType } from '@prisma/client';

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

interface AdminEventsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    status?: ExperienceStatus | 'ALL';
    type?: ExperienceType | 'ALL';
    collective?: string;
  }>;
}

export default async function AdminEventsPage({
  params,
  searchParams,
}: AdminEventsPageProps) {
  const { locale } = await params;
  const filters = await searchParams;
  const [t, tExp, collectiveEventsEnabled] = await Promise.all([
    getTranslations({ locale, namespace: 'admin.events' }),
    getTranslations({ locale, namespace: 'experience' }),
    isFlagEnabled('COLLECTIVE_EVENTS'),
  ]);

  const q = filters.q?.trim() ?? '';
  const status =
    filters.status && filters.status !== 'ALL' ? filters.status : undefined;
  const type =
    filters.type && filters.type !== 'ALL' ? filters.type : undefined;
  // Collective-specific controls (filter, badge, participants column) only
  // exist when the feature is ON — flag OFF keeps the plain support console.
  const collectiveOnly = collectiveEventsEnabled && filters.collective === '1';

  const experiences = await db.experience.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(collectiveOnly ? { isCollective: true } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { winery: { name: { contains: q, mode: 'insensitive' } } },
              { winery: { commune: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      duration: true,
      type: true,
      status: true,
      isCollective: true,
      winery: { select: { id: true, name: true, commune: true, status: true } },
      _count: { select: { participants: true } },
    },
  });

  // Read-only activity stats (sold + scanned seats) for the listed events.
  const experienceIds = experiences.map((experience) => experience.id);
  const [soldGroups, scannedGroups] = experienceIds.length
    ? await Promise.all([
        db.booking.groupBy({
          by: ['experienceId'],
          where: {
            experienceId: { in: experienceIds },
            status: { in: [...COLLECTIVE_SOLD_STATUSES] },
          },
          _sum: { guestCount: true },
        }),
        db.booking.groupBy({
          by: ['experienceId'],
          where: {
            experienceId: { in: experienceIds },
            status: BookingStatus.COMPLETED,
          },
          _sum: { guestCount: true },
        }),
      ])
    : [[], []];
  const soldById = new Map(
    soldGroups.map((group) => [group.experienceId, group._sum.guestCount ?? 0])
  );
  const scannedById = new Map(
    scannedGroups.map((group) => [
      group.experienceId,
      group._sum.guestCount ?? 0,
    ])
  );

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-display-md text-burgundy-700">
          {t('title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle>{t('filters.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder={t('filters.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <select
              name="status"
              defaultValue={status ?? 'ALL'}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">{t('filters.allStatuses')}</option>
              <option value="DRAFT">{t('status.DRAFT')}</option>
              <option value="PUBLISHED">{t('status.PUBLISHED')}</option>
              <option value="ARCHIVED">{t('status.ARCHIVED')}</option>
            </select>
            <select
              name="type"
              defaultValue={type ?? 'ALL'}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">{t('filters.allTypes')}</option>
              {EXPERIENCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {tExp(`types.${option.value}`)}
                </option>
              ))}
            </select>
            <Button type="submit">{t('filters.apply')}</Button>
            {collectiveEventsEnabled && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-4">
                <input
                  type="checkbox"
                  name="collective"
                  value="1"
                  defaultChecked={collectiveOnly}
                  className="h-4 w-4 rounded border-input"
                />
                {t('filters.collectiveOnly')}
              </label>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-warm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">{t('table.event')}</th>
                  <th className="px-6 py-4">{t('table.winery')}</th>
                  <th className="px-6 py-4">{t('table.status')}</th>
                  <th className="px-6 py-4">{t('table.type')}</th>
                  {collectiveEventsEnabled && (
                    <th className="px-6 py-4">{t('table.participants')}</th>
                  )}
                  <th className="px-6 py-4">{t('table.activity')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {experiences.length === 0 ? (
                  <tr>
                    <td
                      colSpan={collectiveEventsEnabled ? 6 : 5}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      {t('table.noResults')}
                    </td>
                  </tr>
                ) : (
                  experiences.map((experience) => (
                    <tr key={experience.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {experience.title}
                          </p>
                          {collectiveEventsEnabled &&
                            experience.isCollective && (
                              <Badge variant="gold">
                                {t('table.collectiveBadge')}
                              </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {experience.price / 100} CHF · {experience.duration}m
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/wineries/${experience.winery.id}`}
                          className="font-medium text-burgundy-700 hover:underline"
                        >
                          {experience.winery.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {experience.winery.commune} ·{' '}
                          {experience.winery.status}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            experience.status === 'PUBLISHED'
                              ? 'success'
                              : experience.status === 'ARCHIVED'
                                ? 'secondary'
                                : 'warning'
                          }
                        >
                          {t(`status.${experience.status}`)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {tExp(`types.${experience.type}`)}
                      </td>
                      {collectiveEventsEnabled && (
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {experience.isCollective
                            ? experience._count.participants
                            : '—'}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {t('table.activityValue', {
                          sold: soldById.get(experience.id) ?? 0,
                          scanned: scannedById.get(experience.id) ?? 0,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
