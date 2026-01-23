import { Clock, Users, Globe, GraduationCap } from 'lucide-react';
import type { ExperienceType } from '@prisma/client';

interface QuickFactsProps {
  duration: number;
  maxCapacity: number;
  type: ExperienceType;
  languages?: string[];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} Min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

const TYPE_LABELS: Record<ExperienceType, string> = {
  TASTING: 'Wine Tasting',
  CELLAR_VISIT: 'Guided Tour',
  WORKSHOP: 'Workshop',
  VINEYARD_TOUR: 'Vineyard Tour',
  FOOD_PAIRING: 'Food Pairing',
};

export function QuickFacts({
  duration,
  maxCapacity,
  type,
  languages = ['FR', 'DE', 'EN'],
}: QuickFactsProps) {
  return (
    <div className="flex flex-wrap gap-3 pb-6 border-b border-[#f2e9eb]">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f2e9eb] text-[#1a0f12]">
        <Clock className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">{formatDuration(duration)}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f2e9eb] text-[#1a0f12]">
        <Users className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">Max {maxCapacity} Guests</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f2e9eb] text-[#1a0f12]">
        <Globe className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">{languages.join(' / ')}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f2e9eb] text-[#1a0f12]">
        <GraduationCap className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">{TYPE_LABELS[type]}</span>
      </div>
    </div>
  );
}
