import { CheckCircle } from 'lucide-react';
import type { ExperienceType } from '@prisma/client';

interface WhatsIncludedProps {
  type: ExperienceType;
  inclusions?: string[];
}

// Default inclusions based on experience type
const DEFAULT_INCLUSIONS: Record<ExperienceType, string[]> = {
  TASTING: [
    'Guided wine tasting',
    'Selection of premium wines',
    'Tasting notes & pairing suggestions',
    'Water and bread palette cleansers',
  ],
  CELLAR_VISIT: [
    'Guided cellar tour',
    'Wine tasting session',
    'History and winemaking explanation',
    'Complimentary tasting glass',
  ],
  WORKSHOP: [
    'Expert-led workshop',
    'All materials included',
    'Wine tasting',
    'Certificate of participation',
  ],
  VINEYARD_TOUR: [
    'Guided vineyard walk',
    'Wine tasting session',
    'Local terroir education',
    'Panoramic views',
  ],
  FOOD_PAIRING: [
    'Wine tasting selection',
    'Local cheese & meat platter',
    'Expert pairing guidance',
    'Tasting notes',
  ],
};

export function WhatsIncluded({ type, inclusions }: WhatsIncludedProps) {
  const items = inclusions ?? DEFAULT_INCLUSIONS[type] ?? DEFAULT_INCLUSIONS.TASTING;

  return (
    <section>
      <h3 className="text-2xl font-bold mb-6 text-[#1a0f12]">What&apos;s included</h3>
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
