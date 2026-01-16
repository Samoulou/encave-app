import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Clock, Wine } from 'lucide-react';
import type { ExperienceType } from '@prisma/client';
import { formatCHF } from '@/lib/utils/currency';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';

interface RelatedExperience {
  id: string;
  title: string;
  slug: string;
  type: ExperienceType;
  duration: number;
  price: number;
  coverPhoto: string;
  winery: {
    name: string;
    slug: string;
    commune: string;
  };
}

interface RelatedExperiencesProps {
  experiences: RelatedExperience[];
}

const TYPE_LABELS: Record<ExperienceType, string> = {
  TASTING: 'Wine Tasting',
  CELLAR_VISIT: 'Cellar Visit',
  WORKSHOP: 'Workshop',
  VINEYARD_TOUR: 'Vineyard Tour',
  FOOD_PAIRING: 'Food Pairing',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}min`;
}

export function RelatedExperiences({ experiences }: RelatedExperiencesProps) {
  return (
    <section data-testid="related-experiences">
      <h2 className="font-display text-2xl font-semibold text-slate-900">
        You might also like
      </h2>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {experiences.map((experience) => (
          <Link
            key={experience.id}
            href={`/experiences/${experience.slug}`}
            className="group overflow-hidden rounded-xl bg-white shadow-warm transition-all hover:-translate-y-1 hover:shadow-warm-lg"
            data-testid="experience-card"
          >
            {/* Image */}
            <div className="relative aspect-[4/3] overflow-hidden">
              {experience.coverPhoto ? (
                <Image
                  src={experience.coverPhoto}
                  alt={experience.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  placeholder="blur"
                  blurDataURL={IMAGE_PLACEHOLDERS.card}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-burgundy-100 to-burgundy-200">
                  <Wine className="h-12 w-12 text-burgundy-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

              {/* Type Badge */}
              <span className="absolute left-3 top-3 rounded-full bg-gold-400 px-2.5 py-1 text-xs font-medium text-gold-950">
                {TYPE_LABELS[experience.type]}
              </span>

              {/* Price */}
              <div className="absolute bottom-3 right-3 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur-sm">
                {formatCHF(experience.price)}
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <h3 className="font-display text-lg font-semibold text-slate-900 line-clamp-1 group-hover:text-burgundy-700">
                {experience.title}
              </h3>

              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                <MapPin className="h-3.5 w-3.5" />
                {experience.winery.name}, {experience.winery.commune}
              </p>

              <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(experience.duration)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
