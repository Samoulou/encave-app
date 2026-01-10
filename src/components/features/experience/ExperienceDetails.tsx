import { Clock, Users } from 'lucide-react';

interface ExperienceDetailsProps {
  description: string;
  duration: number;
  minCapacity: number;
  maxCapacity: number;
}

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

function formatCapacity(min: number, max: number): string {
  if (min === max) {
    return `${min} ${min === 1 ? 'person' : 'people'}`;
  }
  return `${min}-${max} people`;
}

export function ExperienceDetails({
  description,
  duration,
  minCapacity,
  maxCapacity,
}: ExperienceDetailsProps) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-warm lg:p-8">
      <h2 className="font-display text-xl font-semibold text-slate-900">
        About This Experience
      </h2>

      {/* Quick Info */}
      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-burgundy-50 px-4 py-2">
          <Clock className="h-5 w-5 text-burgundy-600" />
          <span className="text-sm font-medium text-burgundy-900">
            {formatDuration(duration)}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-burgundy-50 px-4 py-2">
          <Users className="h-5 w-5 text-burgundy-600" />
          <span className="text-sm font-medium text-burgundy-900">
            {formatCapacity(minCapacity, maxCapacity)}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="mt-6 prose prose-slate max-w-none">
        <p className="whitespace-pre-wrap text-slate-600 leading-relaxed">
          {description}
        </p>
      </div>
    </section>
  );
}
