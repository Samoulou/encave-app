import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { auth } from '@/server/auth';
import { getEventDetail } from '@/server/queries/event-detail.queries';
import { eventDetailSlugSchema } from '@/lib/validators/eventDetail';
import { EventDetailHeader } from '@/components/features/event-detail/EventDetailHeader';
import { EventStatusBanner } from '@/components/features/event-detail/EventStatusBanner';
import { SessionGroupSection } from '@/components/features/event-detail/SessionGroupSection';
import { SessionCard } from '@/components/features/event-detail/SessionCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ExperienceStatus } from '@prisma/client';
import { Plus } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import type { EventSessionDTO, SessionGroup } from '@/types/event-detail';

interface PageProps {
  params: Promise<{ locale: string; experienceSlug: string }>;
}

const SCAN_WINDOW_MS = 2 * 60 * 60 * 1000;

interface DerivedSessionRuntime {
  session: EventSessionDTO;
  isLive: boolean;
  isPast: boolean;
}

function decorate(session: EventSessionDTO): DerivedSessionRuntime {
  const now = Date.now();
  const isLive =
    now >= session.startsAt.getTime() && now <= session.endsAt.getTime();
  const isPast = now > session.endsAt.getTime();
  return { session, isLive, isPast };
}

/**
 * Compute the H-2 → H+2 scan window from the day's sessions, in UTC instants.
 * Returns whether the current moment is inside the daily window AND, when so,
 * whether the given session is one of the day's sessions.
 */
function isScanWindowActive(daySessions: EventSessionDTO[]): boolean {
  if (daySessions.length === 0) return false;
  let firstStart = Number.POSITIVE_INFINITY;
  let lastEnd = Number.NEGATIVE_INFINITY;
  for (const session of daySessions) {
    const start = session.startsAt.getTime();
    const end = session.endsAt.getTime();
    if (start < firstStart) firstStart = start;
    if (end > lastEnd) lastEnd = end;
  }
  const now = Date.now();
  return now >= firstStart - SCAN_WINDOW_MS && now <= lastEnd + SCAN_WINDOW_MS;
}

export default async function EventDetailPage({ params }: PageProps) {
  const resolved = await params;
  setRequestLocale(resolved.locale as Locale);

  const localeTyped = resolved.locale as Locale;

  const parsed = eventDetailSlugSchema.safeParse({
    experienceSlug: resolved.experienceSlug,
  });
  if (!parsed.success) {
    redirect({ href: '/dashboard', locale: localeTyped });
    return null;
  }
  const experienceSlug = parsed.data.experienceSlug;

  const session = await auth();
  if (!session?.user) {
    redirect({ href: '/login', locale: localeTyped });
    return null;
  }

  const event = await getEventDetail(experienceSlug, session.user.id);
  if (!event) {
    redirect({ href: '/dashboard', locale: localeTyped });
    return null;
  }

  const t = await getTranslations('Dashboard.eventDetail');

  const todaySessions = event.sessions.filter((s) => s.group === 'today');
  const isScanActive = isScanWindowActive(todaySessions);
  const canEdit = event.experience.status !== ExperienceStatus.ARCHIVED;

  const groupedSessions: Record<SessionGroup, EventSessionDTO[]> = {
    today: todaySessions,
    upcoming: event.sessions.filter((s) => s.group === 'upcoming'),
    past: event.sessions.filter((s) => s.group === 'past'),
    cancelled: event.sessions.filter((s) => s.group === 'cancelled'),
  };

  const hasAnySession = event.sessions.length > 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:gap-8 md:py-10">
      <EventDetailHeader event={event} />
      <EventStatusBanner status={event.experience.status} />

      {!hasAnySession ? <EmptyState title={t('empty.title')} /> : null}

      {!hasAnySession ? (
        <div className="flex justify-center">
          <Button asChild>
            <Link href={`/dashboard/experiences/${event.experience.slug}/edit`}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('empty.cta')}
            </Link>
          </Button>
        </div>
      ) : null}

      {(['today', 'upcoming', 'past', 'cancelled'] as const).map((group) => {
        const sessions = groupedSessions[group];
        if (sessions.length === 0 && group !== 'cancelled') return null;
        if (sessions.length === 0 && group === 'cancelled') return null;

        return (
          <SessionGroupSection
            key={group}
            group={group}
            title={t(`sections.${group}`)}
            count={sessions.length}
          >
            <div className="flex flex-col gap-4">
              {sessions.map((s) => {
                const decorated = decorate(s);
                return (
                  <SessionCard
                    key={s.sessionId}
                    session={s}
                    experienceSlug={event.experience.slug}
                    isLive={decorated.isLive}
                    isScanWindow={group === 'today' ? isScanActive : false}
                    isPast={decorated.isPast}
                    canEdit={canEdit}
                  />
                );
              })}
            </div>
          </SessionGroupSection>
        );
      })}
    </div>
  );
}
