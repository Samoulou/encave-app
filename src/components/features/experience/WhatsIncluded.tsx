'use client';

import { CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ExperienceType } from '@prisma/client';

interface WhatsIncludedProps {
  type: ExperienceType;
  inclusions?: string[];
}

// Keys for default inclusions based on experience type
const INCLUSION_KEYS: Record<ExperienceType, string[]> = {
  TASTING: ['guidedTasting', 'premiumWines', 'tastingNotes', 'paletteCleansers'],
  CELLAR_VISIT: ['guidedTour', 'tastingSession', 'historyExplanation', 'complimentaryGlass'],
  WORKSHOP: ['expertLed', 'materialsIncluded', 'wineTasting', 'certificate'],
  VINEYARD_TOUR: ['guidedWalk', 'tastingSession', 'terroirEducation', 'panoramicViews'],
  FOOD_PAIRING: ['wineSelection', 'localPlatter', 'pairingGuidance', 'tastingNotes'],
};

export function WhatsIncluded({ type, inclusions }: WhatsIncludedProps) {
  const t = useTranslations('experience');

  // If custom inclusions are provided, use them; otherwise use translated defaults
  const items = inclusions ?? INCLUSION_KEYS[type]?.map(key => t(`inclusions.${type}.${key}`)) ?? [];

  return (
    <section>
      <h3 className="text-2xl font-bold mb-6 text-[#1a0f12]">{t('whatsIncluded')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
