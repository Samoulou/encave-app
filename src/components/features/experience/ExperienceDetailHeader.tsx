'use client';

import Link from 'next/link';
import { MapPin, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ExperienceDetailHeaderProps {
  title: string;
  wineryName: string;
  winerySlug: string;
  commune: string;
  rating?: number | null;
  reviewCount?: number;
}

export function ExperienceDetailHeader({
  title,
  wineryName,
  winerySlug,
  commune,
  rating,
  reviewCount = 0,
}: ExperienceDetailHeaderProps) {
  const t = useTranslations('experience');

  return (
    <div className="mb-8">
      <h1 className="mb-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-4xl lg:text-5xl">
        {title}
      </h1>
      <div className="flex flex-wrap items-center gap-4 text-sm md:text-base">
        <Link
          href={`/wineries/${winerySlug}`}
          className="font-semibold text-primary hover:underline"
        >
          {wineryName}
        </Link>
        {rating != null && rating > 0 && (
          <>
            <span className="text-gray-300">•</span>
            <div className="flex items-center gap-1">
              <Star className="h-[18px] w-[18px] fill-yellow-500 text-yellow-500" />
              <span className="font-bold text-foreground">
                {rating.toFixed(1)}
              </span>
              {reviewCount > 0 && (
                <span className="text-gray-500">
                  ({t('reviews', { count: reviewCount })})
                </span>
              )}
            </div>
          </>
        )}
        <span className="text-gray-300">•</span>
        <div className="flex items-center gap-1 text-gray-500">
          <MapPin className="h-[18px] w-[18px]" />
          <span>{commune}, Valais</span>
        </div>
      </div>
    </div>
  );
}
