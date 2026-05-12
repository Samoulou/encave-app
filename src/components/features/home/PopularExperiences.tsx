import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ExperienceCard } from '@/components/features/experience/ExperienceCard';
import type { ExperienceCardData } from '@/components/features/experience/ExperienceCard';

interface PopularExperiencesProps {
  experiences: ExperienceCardData[];
}

export async function PopularExperiences({
  experiences,
}: PopularExperiencesProps) {
  const t = await getTranslations('home');

  if (experiences.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-12 text-center">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">
          {t('curatedForYou')}
        </h2>
        <h3 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
          {t('popularExperiences')}
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
        {experiences.map((experience, index) => (
          <ExperienceCard
            key={experience.id}
            experience={experience}
            priority={index === 0}
          />
        ))}
      </div>

      <div className="mt-12 text-center">
        <Button
          variant="outline"
          size="lg"
          asChild
          className="border-2 border-primary text-primary hover:bg-primary hover:text-white"
        >
          <Link href="/experiences" className="inline-flex items-center gap-2">
            {t('viewAllExperiences')}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
