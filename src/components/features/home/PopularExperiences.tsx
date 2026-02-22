import { ArrowRight, Clock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { formatCHF } from '@/lib/utils/currency';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import type { ExperienceType } from '@prisma/client';

interface Experience {
  id: string;
  title: string;
  slug: string;
  type: ExperienceType;
  duration: number;
  price: number;
  coverPhoto: string;
  winery: {
    id: string;
    name: string;
    slug: string;
    commune: string;
  };
}

interface PopularExperiencesProps {
  experiences: Experience[];
}

export async function PopularExperiences({ experiences }: PopularExperiencesProps) {
  const t = await getTranslations('home');
  const tExp = await getTranslations('experience');

  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return tExp('durationFormat', { count: hours });
      }
      return `${hours}h ${remainingMinutes}min`;
    }
    return tExp('durationMinutes', { count: minutes });
  };

  if (experiences.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="text-center mb-12">
        <h2 className="text-primary font-bold tracking-wider text-sm uppercase mb-2">
          {t('curatedForYou')}
        </h2>
        <h3 className="font-display text-3xl md:text-4xl font-extrabold text-foreground">
          {t('popularExperiences')}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {experiences.map((experience, index) => (
          <Link
            key={experience.id}
            href={`/experiences/${experience.slug}`}
            className="group bg-white dark:bg-[#2a1a1f] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 ease-premium border border-gray-100 dark:border-gray-800 flex flex-col h-full"
          >
            {/* Image */}
            <div className="relative h-60 overflow-hidden">
              <ImageWithFallback
                src={experience.coverPhoto}
                alt={experience.title}
                fill
                className="object-cover transform group-hover:scale-105 transition-transform duration-500 ease-premium"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority={index === 0}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
              {/* Type Badge */}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-foreground shadow-sm">
                {tExp(`types.${experience.type}`)}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col flex-grow">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wide">
                  {experience.winery.commune}
                </span>
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(experience.duration)}
                </span>
              </div>

              <h4 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                {experience.title}
              </h4>

              <p className="text-muted-foreground text-sm mb-4 line-clamp-2 flex-grow">
                {experience.winery.name}
              </p>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <p className="text-lg font-bold text-foreground">
                  {formatCHF(experience.price)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    / {t('perPerson')}
                  </span>
                </p>
                <span className="text-primary font-bold text-sm hover:bg-primary/5 px-3 py-2 rounded-lg transition-colors">
                  {t('bookNow')}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Button variant="outline" size="lg" asChild className="border-2 border-primary text-primary hover:bg-primary hover:text-white">
          <Link href="/experiences" className="inline-flex items-center gap-2">
            {t('viewAllExperiences')}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
