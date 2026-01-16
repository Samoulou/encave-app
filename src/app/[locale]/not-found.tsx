import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Home, Search, Wine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotFoundSearch } from '@/components/shared/NotFoundSearch';
import { db } from '@/server/db';
import { ExperienceStatus } from '@prisma/client';

async function getPopularExperiences() {
  try {
    return await db.experience.findMany({
      where: {
        status: ExperienceStatus.PUBLISHED,
        winery: { status: 'VERIFIED' },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        winery: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });
  } catch {
    return [];
  }
}

export default async function NotFound() {
  const t = await getTranslations('errors');
  const tCommon = await getTranslations('common');
  const popularExperiences = await getPopularExperiences();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-50 px-4" data-testid="not-found">
      <div className="w-full max-w-xl text-center">
        {/* 404 Icon */}
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-burgundy-100">
          <Wine className="h-12 w-12 text-burgundy-600" aria-hidden="true" />
        </div>

        {/* Title & Description */}
        <h1 className="font-display text-4xl font-bold text-slate-900">
          {t('pageNotFound')}
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          {t('pageNotFoundDescription')}
        </p>

        {/* Search Bar */}
        <div className="mt-8">
          <NotFoundSearch placeholder={t('searchPlaceholder')} />
        </div>

        {/* Popular Experiences */}
        {popularExperiences.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t('popularExperiences')}
            </h2>
            <div className="space-y-2">
              {popularExperiences.map((exp) => (
                <Link
                  key={exp.id}
                  href={`/experiences/${exp.slug}`}
                  className="block rounded-lg border border-stone-200 bg-white p-3 text-left transition-all hover:border-burgundy-300 hover:shadow-warm-sm"
                >
                  <span className="font-medium text-slate-900">{exp.title}</span>
                  <span className="ml-2 text-sm text-slate-500">
                    — {exp.winery.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              {tCommon('buttons.goHome')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/experiences">
              <Search className="mr-2 h-4 w-4" />
              {t('browseExperiences')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
