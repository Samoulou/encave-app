import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { getTranslations } from 'next-intl/server';
import {
  getWineryVisibilityCriteria,
  isWineryPubliclyVisible,
} from '@/lib/business-rules/winery-visibility';
import { logError } from '@/lib/logger';
import { VisibilityBannerSuccess } from './VisibilityBannerSuccess';
import { VisibilityBannerPartial } from './VisibilityBannerPartial';
import { VisibilityBannerError } from './VisibilityBannerError';
import { getFirstMissingDeepLink } from './visibility-banner-link';

/**
 * Server Component banner that surfaces the winery's public visibility
 * state on the encaveur dashboard (ENC-027).
 *
 * Three render branches:
 *  - Success (all 6 criteria met) → green confirmation + link to public page.
 *  - Partial (≥1 missing)         → orange banner listing every criterion.
 *  - Error (DB unreachable)       → red banner with retry CTA.
 *
 * Loading is owned by the parent (Suspense + VisibilityBannerSkeleton).
 */
interface VisibilityBannerProps {
  wineryId: string;
}

export async function VisibilityBanner({ wineryId }: VisibilityBannerProps) {
  const session = await auth();
  if (!session?.user) {
    // Should never happen — the parent route is protected. Render nothing.
    return null;
  }

  try {
    const winery = await db.winery.findUnique({
      where: { id: wineryId, userId: session.user.id },
      select: {
        slug: true,
        status: true,
        stripeOnboardingComplete: true,
        description: true,
        latitude: true,
        longitude: true,
        galleryImages: { select: { id: true } },
        experiences: {
          where: { status: 'PUBLISHED' },
          select: { status: true },
        },
      },
    });

    if (!winery) {
      // Not the caller's winery — silently render nothing.
      return null;
    }

    const criteria = getWineryVisibilityCriteria(winery);
    const visible = isWineryPubliclyVisible(winery);

    if (visible) {
      return <VisibilityBannerSuccess winerySlug={winery.slug} />;
    }

    const deepLink = getFirstMissingDeepLink(criteria);
    return <VisibilityBannerPartial criteria={criteria} ctaHref={deepLink} />;
  } catch (error) {
    logError('VisibilityBanner failed to load criteria', error, {
      wineryId,
      action: 'VisibilityBanner.render',
    });
    const t = await getTranslations('Dashboard.visibility.banner.error');
    return (
      <VisibilityBannerError
        title={t('title')}
        subtitle={t('subtitle')}
        retryLabel={t('retry')}
      />
    );
  }
}
