import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ExperienceStatus } from '@prisma/client';
import { ChevronRight, Home, Pencil } from 'lucide-react';
import { Link, redirect } from '@/i18n/navigation';
import { auth } from '@/server/auth';
import { getOccurrenceCalendar } from '@/server/queries/occurrence.queries';
import { getExperienceOperationalContext } from '@/server/queries/event-detail.queries';
import { getOwnerWines } from '@/server/queries/wine.queries';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { eventDetailIdSchema } from '@/lib/validators/eventDetail';
import { OccurrenceCalendar } from '@/components/features/occurrence/OccurrenceCalendar';
import { Button } from '@/components/ui/button';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';
import { isMonthKey } from '@/lib/utils/date-key';
import type { Locale } from '@/i18n/routing';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ mois?: string }>;
}

/**
 * Monthly occurrence calendar of an experience (P-05 / L-132).
 * Repointed from the booking-derived "sessions" view onto
 * `getOccurrenceCalendar` — same URL, occurrence-authoritative data.
 * Month navigation via `?mois=YYYY-MM` (nuqs on the client).
 */
export default async function ExperienceSessionsPage({
  params,
  searchParams,
}: PageProps) {
  const [resolved, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  setRequestLocale(resolved.locale as Locale);
  const localeTyped = resolved.locale as Locale;

  const parsed = eventDetailIdSchema.safeParse({
    experienceId: resolved.id,
  });
  if (!parsed.success) {
    redirect({ href: '/dashboard/experiences', locale: localeTyped });
    return null;
  }
  const experienceId = parsed.data.experienceId;

  const session = await auth();
  if (!session?.user) {
    redirect({ href: '/login', locale: localeTyped });
    return null;
  }

  // Default to the current Zurich month; ignore malformed ?mois values.
  const moisParam = resolvedSearchParams.mois;
  const monthKey =
    moisParam !== undefined && isMonthKey(moisParam)
      ? moisParam
      : zurichTodayAsUTCDate().toISOString().slice(0, 7);

  // Both reads tenant-gate on (experienceId, userId); the context carries
  // the day-J fields (slug, duration, winery name, status) that the
  // calendar DTO doesn't.
  const [calendar, context, tastingEnabled] = await Promise.all([
    getOccurrenceCalendar(experienceId, session.user.id, monthKey),
    getExperienceOperationalContext(experienceId, session.user.id),
    isFlagEnabled('TASTING_SHEET'),
  ]);
  if (!calendar || !context) {
    redirect({ href: '/dashboard/experiences', locale: localeTyped });
    return null;
  }

  // Tasting sheet (P-07): null = flag OFF, the section never renders.
  const tastingWines = tastingEnabled
    ? await getOwnerWines(session.user.id)
    : null;

  const t = await getTranslations('Dashboard.eventDetail');

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:gap-8 md:py-10">
      <header className="flex flex-col gap-4">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-slate-500"
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-1 hover:text-slate-900"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{t('breadcrumb.dashboard')}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/dashboard/experiences" className="hover:text-slate-900">
            {t('breadcrumb.events')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="truncate font-medium text-slate-900">
            {calendar.title}
          </span>
        </nav>

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              {calendar.title}
            </h1>
            <p className="text-sm text-slate-500">
              {t('occurrences.subtitle', { count: calendar.maxCapacity })}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/experiences/${calendar.experienceId}/edit`}>
              <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              {t('occurrences.editAvailability')}
            </Link>
          </Button>
        </div>
      </header>

      <OccurrenceCalendar
        experienceId={calendar.experienceId}
        experienceSlug={context.slug}
        experienceTitle={context.title}
        wineryName={context.wineryName}
        durationMinutes={context.duration}
        canEdit={context.status !== ExperienceStatus.ARCHIVED}
        monthKey={calendar.monthKey}
        entries={calendar.entries}
        tastingWines={tastingWines}
      />
    </div>
  );
}
