import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Wine } from 'lucide-react';
import type { ExperienceType } from '@prisma/client';
import { formatCHF } from '@/lib/utils/currency';
import { IMAGE_PLACEHOLDERS } from '@/lib/image-placeholder';

interface ExperienceHeroProps {
  title: string;
  type: ExperienceType;
  price: number;
  coverPhoto: string;
}

export function ExperienceHero({
  title,
  type,
  price,
  coverPhoto,
}: ExperienceHeroProps) {
  const t = useTranslations('experience');
  const tCommon = useTranslations('common');

  return (
    <section className="relative h-[50vh] min-h-[400px] w-full">
      {coverPhoto ? (
        <Image
          src={coverPhoto}
          alt={title}
          fill
          className="object-cover"
          priority
          sizes="100vw"
          placeholder="blur"
          blurDataURL={IMAGE_PLACEHOLDERS.hero}
          data-testid="experience-hero-image"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-burgundy-700 to-burgundy-900">
          <div className="absolute inset-0 flex items-center justify-center">
            <Wine className="h-32 w-32 text-burgundy-500/30" />
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-burgundy-950/80 via-burgundy-900/30 to-transparent" />

      {/* Hero Content */}
      <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
        <div className="mx-auto max-w-7xl">
          {/* Type Badge */}
          <span
            className="inline-flex items-center rounded-full bg-gold-400 px-3 py-1 text-sm font-medium text-gold-950"
            data-testid="experience-type-badge"
          >
            {t(`types.${type}`)}
          </span>

          {/* Title */}
          <h1 className="mt-3 font-display text-display-lg text-white">
            {title}
          </h1>

          {/* Price */}
          <p
            className="mt-2 text-2xl font-semibold text-white"
            data-testid="hero-price"
          >
            {formatCHF(price)}
            <span className="ml-2 text-base font-normal text-white/70">
              {tCommon('currency.perPerson')}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
