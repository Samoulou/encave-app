import { getTranslations } from 'next-intl/server';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { Link } from '@/i18n/navigation';
import { ArrowUpRight } from 'lucide-react';
import type { EventParticipantPublicDTO } from '@/server/queries/event-participant.queries';

interface EventParticipantsSectionProps {
  participants: EventParticipantPublicDTO[];
}

/**
 * Collective-event participants grid + mini-program (P-11 / L-101).
 * Rendered only when the experience is a flag-enabled collective event with
 * ≥1 visible participant — the caller passes the already-loaded (deduped)
 * list, so this stays a pure presentational server component.
 */
export async function EventParticipantsSection({
  participants,
}: EventParticipantsSectionProps) {
  if (participants.length === 0) {
    return null;
  }

  const t = await getTranslations('experience');

  return (
    <section className="mt-9" data-testid="collective-participants">
      <h2 className="mb-1 font-display text-2xl font-semibold text-ink-900">
        {t('detail.collective.programTitle')}
      </h2>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        {t('detail.collective.programSubtitle')}
      </p>
      <ol className="grid gap-4 sm:grid-cols-2">
        {participants.map((participant, index) => (
          <li
            key={participant.id}
            className="flex gap-4 rounded-[14px] border border-stone-200 bg-white p-4 shadow-audit-card"
            data-testid="collective-participant"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-cream-200">
              <ImageWithFallback
                src={participant.logoUrl ?? ''}
                alt={participant.wineryName}
                fill
                className="object-cover"
                sizes="56px"
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-ink-400 font-mono text-[10px] uppercase tracking-[0.1em]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Link
                  href={`/wineries/${participant.winerySlug}`}
                  className="inline-flex items-center gap-1 font-display text-base font-semibold text-ink-900 hover:text-burgundy-700"
                >
                  {participant.wineryName}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              <div className="truncate text-xs text-ink-500">
                {participant.commune}
              </div>
              {participant.description && (
                <p className="mt-2 text-sm leading-6 text-ink-700">
                  {participant.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
