import { CheckCircle2, ExternalLink } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/**
 * Green confirmation banner shown when all 6 ENC-027 visibility
 * criteria are met. The winery is live and discoverable on the
 * public site.
 */
interface VisibilityBannerSuccessProps {
  winerySlug: string;
}

export async function VisibilityBannerSuccess({
  winerySlug,
}: VisibilityBannerSuccessProps) {
  const t = await getTranslations('Dashboard.visibility.banner.success');

  return (
    <section
      role="region"
      aria-labelledby="visibility-banner-success-title"
      className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h2
            id="visibility-banner-success-title"
            className="font-display text-lg font-semibold text-emerald-900 sm:text-xl"
          >
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-emerald-800">{t('subtitle')}</p>

          <div className="mt-5">
            <Button
              asChild
              variant="secondary"
              className="min-h-[44px] w-full sm:w-auto"
            >
              <Link
                href={`/wineries/${winerySlug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('viewPublic')}
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
