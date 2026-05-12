import { ExperienceType } from '@prisma/client';
import {
  EXPERIENCE_TYPE_COLORS,
  EXPERIENCE_TYPE_LABELS,
} from '@/lib/constants/experience-type-colors';
import { cn } from '@/lib/utils';

interface ExperienceTypeDotProps {
  type: ExperienceType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
};

export function ExperienceTypeDot({
  type,
  size = 'md',
  showLabel = false,
  className,
}: ExperienceTypeDotProps) {
  const color = EXPERIENCE_TYPE_COLORS[type];
  const label = EXPERIENCE_TYPE_LABELS[type];

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn('inline-block rounded-full', SIZE_CLASSES[size])}
        style={{ backgroundColor: color }}
        title={label}
      />
      {showLabel && <span className="text-xs text-slate-600">{label}</span>}
    </div>
  );
}

interface ExperienceTypeDotsProps {
  types: ExperienceType[];
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ExperienceTypeDots({
  types,
  maxVisible = 3,
  size = 'sm',
  className,
}: ExperienceTypeDotsProps) {
  const uniqueTypes = Array.from(new Set(types));
  const visibleTypes = uniqueTypes.slice(0, maxVisible);
  const hiddenCount = uniqueTypes.length - maxVisible;

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {visibleTypes.map((type) => (
        <ExperienceTypeDot key={type} type={type} size={size} />
      ))}
      {hiddenCount > 0 && (
        <span className="text-[10px] text-slate-400">+{hiddenCount}</span>
      )}
    </div>
  );
}
