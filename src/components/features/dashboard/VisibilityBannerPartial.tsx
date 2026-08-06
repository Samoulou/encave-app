import { AlertCircle, ArrowRight, Check, Circle, Clock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import type { WineryVisibilityCriteria } from '@/lib/business-rules/winery-visibility';

/**
 * Orange banner shown when at least one ENC-027 visibility criterion
 * is missing. Lists each criterion with an icon (validated / to do /
 * in-progress) and a deep-link CTA pointing at the first missing item.
 *
 * Ordering follows the UX rationale (ENC-027-ux-ui.md §4):
 * verified → kyc → address → description → photos → experience.
 */
interface VisibilityBannerPartialProps {
  criteria: WineryVisibilityCriteria;
  ctaHref: string;
}

type CriterionKey =
  | 'verified'
  | 'kyc'
  | 'address'
  | 'description'
  | 'photos'
  | 'experience';

type CriterionState = 'done' | 'pending' | 'inProgress';

interface CriterionRow {
  key: CriterionKey;
  state: CriterionState;
}

function buildCriterionRows(
  criteria: WineryVisibilityCriteria
): CriterionRow[] {
  // `verified` is the only criterion that is not directly actionable by
  // the winemaker. While it's pending we show it as "in progress" with a
  // clock icon. When it's done, hide it altogether (per Léa §4).
  const verifiedRow: CriterionRow | null = criteria.verified
    ? null
    : { key: 'verified', state: 'inProgress' };

  const rows: CriterionRow[] = [
    ...(verifiedRow ? [verifiedRow] : []),
    { key: 'kyc', state: criteria.kyc ? 'done' : 'pending' },
    {
      key: 'address',
      state: criteria.hasGeocoding ? 'done' : 'pending',
    },
    {
      key: 'description',
      state: criteria.hasDescription ? 'done' : 'pending',
    },
    { key: 'photos', state: criteria.hasPhotos ? 'done' : 'pending' },
    {
      key: 'experience',
      state: criteria.hasPublishedExperience ? 'done' : 'pending',
    },
  ];

  return rows;
}

export async function VisibilityBannerPartial({
  criteria,
  ctaHref,
}: VisibilityBannerPartialProps) {
  const [t, tCriteria] = await Promise.all([
    getTranslations('Dashboard.visibility.banner'),
    getTranslations('Dashboard.visibility.criteria'),
  ]);

  const rows = buildCriterionRows(criteria);

  return (
    <section
      role="region"
      aria-labelledby="visibility-banner-partial-title"
      className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h2
            id="visibility-banner-partial-title"
            className="font-display text-lg font-semibold text-amber-900 sm:text-xl"
          >
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-amber-800">{t('subtitle')}</p>

          <ul role="list" className="mt-5 space-y-2.5">
            {rows.map((row) => {
              const label = tCriteria(row.key);
              return (
                <li key={row.key} className="flex items-center gap-3">
                  <CriterionIcon state={row.state} />
                  <span className="sr-only">
                    {row.state === 'done'
                      ? tCriteria('srValidated')
                      : row.state === 'inProgress'
                        ? tCriteria('srInProgress')
                        : tCriteria('srToComplete')}
                  </span>
                  <span
                    className={
                      row.state === 'done'
                        ? 'text-sm text-amber-900'
                        : 'text-sm text-amber-900'
                    }
                  >
                    {label}
                  </span>
                  {row.state === 'done' && (
                    <span className="ml-auto text-xs font-medium text-emerald-700">
                      {tCriteria('done')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-6">
            <Button asChild size="lg" className="min-h-[44px] w-full sm:w-auto">
              <Link href={ctaHref}>
                {t('cta')}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CriterionIcon({ state }: { state: CriterionState }) {
  const iconClass = 'h-5 w-5 flex-shrink-0';

  if (state === 'done') {
    return (
      <Check className={`${iconClass} text-emerald-600`} aria-hidden="true" />
    );
  }
  if (state === 'inProgress') {
    return (
      <Clock className={`${iconClass} text-amber-600`} aria-hidden="true" />
    );
  }
  return (
    <Circle className={`${iconClass} text-amber-500`} aria-hidden="true" />
  );
}
