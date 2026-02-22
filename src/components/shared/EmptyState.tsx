import { Wine } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cream-50 via-stone-50 to-burgundy-50/30 py-16 px-8 text-center">
      {/* Decorative dot pattern */}
      <div className="absolute inset-0 pattern-dots" aria-hidden="true" />

      <div className="relative">
        {/* Icon with decorative ring */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-burgundy-100 to-burgundy-200 ring-4 ring-burgundy-100/50 ring-offset-2 ring-offset-cream-50">
          {icon ?? <Wine className="h-10 w-10 text-burgundy-400" />}
        </div>

        <h3 className="font-display text-xl font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="mx-auto mt-3 max-w-md text-slate-600">{description}</p>
        )}

        {/* Decorative vine ornament */}
        <div className="mx-auto mt-6 w-32 ornament-vine" aria-hidden="true" />
      </div>
    </div>
  );
}
