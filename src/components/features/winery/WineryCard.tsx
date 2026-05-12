'use client';

import { Link } from '@/i18n/navigation';
import { MapPin, ArrowRight } from 'lucide-react';
import { VerifiedBadge } from '@/components/shared/VerifiedBadge';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { useTranslations } from 'next-intl';

interface WineryCardProps {
  winery: {
    slug: string;
    name: string;
    commune: string;
    description: string;
    coverPhoto: string | null;
    status?: string;
  };
}

export function WineryCard({ winery }: WineryCardProps) {
  const t = useTranslations('wineries');
  const isVerified = winery.status === 'VERIFIED';

  return (
    <Link
      href={`/wineries/${winery.slug}`}
      className="group block h-full"
      data-testid="winery-card"
    >
      <article className="h-full overflow-hidden rounded-xl border border-stone-200/60 bg-white shadow-warm transition-all duration-300 ease-premium hover:-translate-y-1 hover:shadow-card-hover">
        {/* Image Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <ImageWithFallback
            src={winery.coverPhoto ?? ''}
            alt={winery.name}
            fill
            className="object-cover transition-transform duration-500 ease-premium group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Verified Badge */}
          {isVerified && (
            <div className="absolute right-3 top-3">
              <VerifiedBadge size="sm" showLabel={false} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-slate-900 transition-colors group-hover:text-burgundy-700">
            {winery.name}
          </h3>

          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            {winery.commune}, Valais
          </p>

          <p className="mt-3 line-clamp-2 text-sm text-slate-600">
            {winery.description}
          </p>

          {/* CTA */}
          <div className="mt-4 flex items-center text-sm font-medium text-burgundy-600 transition-colors group-hover:text-burgundy-700">
            {t('discover')}
            <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </div>
      </article>
    </Link>
  );
}
