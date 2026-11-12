import { useTranslations } from 'next-intl';
import {
  ExperienceCard,
  type ExperienceCardData,
} from '@/components/features/experience/ExperienceCard';
import { Skeleton } from '@/components/shared/Skeleton';

interface ExperiencesStaticFallbackProps {
  experiences: ExperienceCardData[];
  total: number;
}

/**
 * Server-rendered default grid, used as the Suspense FALLBACK of the
 * interactive catalogue. ExperiencesPageClient reads the URL through nuqs
 * (useSearchParams), which on this ISR page bails out to client rendering:
 * without a meaningful fallback the prerendered HTML only carried
 * skeletons — no card, no link to a fiche, nothing for crawlers or for the
 * first paint. The fallback is what ships in the HTML; the client takes
 * over with the same dataset once hydrated.
 */
export function ExperiencesStaticFallback({
  experiences,
  total,
}: ExperiencesStaticFallbackProps) {
  const t = useTranslations('search');

  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
      <aside className="hidden lg:block" aria-hidden="true">
        <div className="sticky top-24 space-y-5 rounded-[18px] border border-stone-200 bg-white p-5">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </aside>

      <div className="min-w-0">
        <h2 className="mb-5 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-burgundy-700">
          {t('resultsCount', { count: total })}
        </h2>
        {experiences.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {experiences.map((experience, index) => (
              <ExperienceCard
                key={experience.id}
                experience={experience}
                priority={index < 2}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-stone-300 bg-white p-10 text-center">
            <p className="font-display text-xl font-semibold">
              {t('noResultsFound')}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              {t('tryDifferentFilters')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
