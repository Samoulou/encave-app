'use client';

import { Grape, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/**
 * Custom 404 page for the `/wineries/[slug]` segment.
 *
 * Triggered automatically by `notFound()` from `page.tsx` when
 * `getWineryBySlug(slug)` returns `null` — i.e. when the winery doesn't
 * exist, or fails any of the ENC-027 public visibility criteria
 * (status, KYC, photos, description, geocoding, ≥1 published experience).
 *
 * Per product decision, we don't differentiate "draft" from "non-existent"
 * to avoid leaking the existence of a draft winery.
 *
 * Client component (P-06): Next prerenders the segment's not-found
 * boundary together with the ISR route — a server-side implicit
 * getTranslations() here fell back to headers() and silently demoted
 * the whole /wineries/[slug] route to per-request rendering.
 */
export default function WineryNotFound() {
  const t = useTranslations('Public.winery.notFound');

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-cream-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Decorative icon bubble */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-burgundy-100/70">
          <Grape className="h-10 w-10 text-burgundy-600" aria-hidden="true" />
        </div>

        <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
          {t('title')}
        </h1>

        <p className="mt-3 text-base text-slate-600 sm:text-lg">{t('body')}</p>

        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" className="min-h-[44px]">
            <Link href="/wineries">
              {t('cta')}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
