'use client';

import { Link } from '@/i18n/navigation';
import { Clock, Users, MapPin, Navigation } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCHF } from '@/lib/utils/currency';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { formatDistance } from '@/lib/geo-utils';
import { useTranslations } from 'next-intl';
import type { ExperienceType } from '@prisma/client';

export interface ExperienceCardData {
  id: string;
  title: string;
  slug: string;
  type: ExperienceType;
  duration: number;
  price: number;
  maxCapacity?: number;
  coverPhoto: string;
  winery: {
    name: string;
    slug: string;
    commune: string;
  };
  distance?: number | null;
}

interface ExperienceCardProps {
  experience: ExperienceCardData;
  className?: string;
  priority?: boolean;
}

export function ExperienceCard({
  experience,
  className,
  priority = false,
}: ExperienceCardProps) {
  const t = useTranslations('experience');
  const tCommon = useTranslations('common');

  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return t('durationFormat', { count: hours });
      }
      return `${hours}h ${remainingMinutes}min`;
    }
    return t('durationMinutes', { count: minutes });
  };

  return (
    <Link
      href={`/experiences/${experience.slug}`}
      className={cn('group block h-full', className)}
      data-testid="experience-card"
    >
      <Card className="flex h-full flex-col overflow-hidden">
        {/* Cover Photo */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <ImageWithFallback
            src={experience.coverPhoto}
            alt={experience.title}
            fill
            className="object-cover transition-transform duration-500 ease-premium group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
          />
          {/* Subtle gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent transition-opacity duration-300 group-hover:from-black/25" />
          {/* Type Badge */}
          <div className="absolute right-3 top-3 z-10">
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
              {t(`types.${experience.type}`)}
            </span>
          </div>
        </div>

        {/* Content */}
        <CardContent className="flex flex-1 flex-col p-5">
          {/* Winery Name */}
          <p
            className="text-sm font-medium text-burgundy-600"
            data-testid="winery-name"
          >
            {experience.winery.name}
          </p>

          {/* Title */}
          <h3
            className="mt-1 line-clamp-2 font-display text-lg font-semibold text-foreground transition-colors group-hover:text-burgundy-700"
            data-testid="experience-title"
          >
            {experience.title}
          </h3>

          {/* Location with optional distance */}
          <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{experience.winery.commune}</span>
            </div>
            {experience.distance != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-burgundy-50 px-2 py-0.5 text-xs font-medium text-burgundy-700">
                <Navigation className="h-3 w-3" aria-hidden="true" />
                {formatDistance(experience.distance)}
              </span>
            )}
          </div>

          {/* Meta Info */}
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <span
              className="flex items-center gap-1"
              data-testid="experience-duration"
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatDuration(experience.duration)}
            </span>
            {experience.maxCapacity != null && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" aria-hidden="true" />
                {t('upTo', { count: experience.maxCapacity })}
              </span>
            )}
          </div>

          {/* Price — pinned to bottom */}
          <div className="mt-auto flex items-center justify-between pt-4">
            <span
              className="text-lg font-semibold text-foreground"
              data-testid="experience-price"
            >
              {formatCHF(experience.price)}
            </span>
            <span className="text-sm text-muted-foreground">
              {tCommon('currency.perPerson')}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
