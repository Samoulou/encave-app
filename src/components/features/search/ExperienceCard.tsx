import Link from 'next/link';
import { Clock, Users, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ExperienceType } from '@prisma/client';

const TYPE_LABELS: Record<ExperienceType, string> = {
  TASTING: 'Tasting',
  CELLAR_VISIT: 'Cellar Visit',
  WORKSHOP: 'Workshop',
  VINEYARD_TOUR: 'Vineyard Tour',
  FOOD_PAIRING: 'Food Pairing',
};

interface ExperienceCardProps {
  experience: {
    id: string;
    title: string;
    slug: string;
    type: ExperienceType;
    duration: number;
    price: number;
    maxCapacity: number;
    coverPhoto: string;
    winery: {
      name: string;
      slug: string;
      commune: string;
    };
  };
  className?: string;
}

export function ExperienceCard({ experience, className }: ExperienceCardProps) {
  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return hours === 1 ? '1 hour' : `${hours} hours`;
      }
      return `${hours}h ${remainingMinutes}min`;
    }
    return `${minutes} min`;
  };

  const formatPrice = (cents: number): string => {
    return `CHF ${(cents / 100).toFixed(0)}`;
  };

  return (
    <Link
      href={`/experiences/${experience.slug}`}
      className={cn('group block', className)}
    >
      <Card className="overflow-hidden">
        {/* Cover Photo */}
        <div className="relative aspect-[4/3] bg-slate-100">
          {experience.coverPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={experience.coverPhoto}
              alt={experience.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {/* Type Badge */}
          <div className="absolute right-3 top-3">
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
              {TYPE_LABELS[experience.type]}
            </span>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-5">
          {/* Winery Name */}
          <p className="text-sm font-medium text-burgundy-600">
            {experience.winery.name}
          </p>

          {/* Title */}
          <h3 className="mt-1 font-display text-lg font-semibold text-slate-900 line-clamp-2 group-hover:text-burgundy-700 transition-colors">
            {experience.title}
          </h3>

          {/* Location */}
          <div className="mt-2 flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{experience.winery.commune}</span>
          </div>

          {/* Meta Info */}
          <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatDuration(experience.duration)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" aria-hidden="true" />
              Up to {experience.maxCapacity}
            </span>
          </div>

          {/* Price */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-lg font-semibold text-slate-900">
              {formatPrice(experience.price)}
            </span>
            <span className="text-sm text-slate-500">per person</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
