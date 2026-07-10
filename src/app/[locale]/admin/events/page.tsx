import Link from 'next/link';
import { Search } from 'lucide-react';
import { db } from '@/server/db';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  searchParams: Promise<{
    q?: string;
    status?: ExperienceStatus | 'ALL';
    type?: ExperienceType | 'ALL';
  }>;
}

export default async function AdminEventsPage({
  searchParams,
}: AdminEventsPageProps) {
  const filters = await searchParams;
  const q = filters.q?.trim() ?? '';
  const status =
    filters.status && filters.status !== 'ALL' ? filters.status : undefined;
  const type =
    filters.type && filters.type !== 'ALL' ? filters.type : undefined;

  const experiences = await db.experience.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
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
    include: {
      winery: { select: { id: true, name: true, commune: true, status: true } },
      _count: { select: { bookings: true } },
    },
  });

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="font-display text-display-md text-burgundy-700">
          Admin events
        </h1>
        <p className="mt-2 text-muted-foreground">
          Search and review published, draft, archived, or suspended-offer
          inventory for support.
        </p>
      </div>

      <Card className="shadow-warm">
        <CardHeader>
          <CardTitle>Search filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Title, winery, commune"
                className="pl-9"
              />
            </div>
            <select
              name="status"
              defaultValue={status ?? 'ALL'}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select
              name="type"
              defaultValue={type ?? 'ALL'}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ALL">All types</option>
              <option value="TASTING">Tasting</option>
              <option value="CELLAR_VISIT">Cellar visit</option>
              <option value="WORKSHOP">Workshop</option>
              <option value="VINEYARD_TOUR">Vineyard tour</option>
              <option value="FOOD_PAIRING">Food pairing</option>
            </select>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-warm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Winery</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Bookings</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {experiences.map((experience) => (
                  <tr key={experience.id}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">
                        {experience.title}
                      </p>
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
                        {experience.winery.commune} · {experience.winery.status}
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
                        {experience.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {experience.type}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {experience._count.bookings}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/experiences/${experience.id}/sessions`}
                      >
                        <Button variant="outline" size="sm">
                          Sessions
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
