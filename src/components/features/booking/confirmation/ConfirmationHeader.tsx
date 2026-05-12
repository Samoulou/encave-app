import { CheckCircle2 } from 'lucide-react';

interface ConfirmationHeaderProps {
  title: string;
  subtitle: string;
}

/**
 * ENC-067 — Header succès sobre.
 *
 * Remplace `ConfirmationSuccess` (qui dépendait de `visitorEmail` + animait
 * un checkmark exubérant). Icône CheckCircle2 verte dans une bulle
 * `emerald-50` + h1 + p discret. Pas d'animation.
 */
export function ConfirmationHeader({
  title,
  subtitle,
}: ConfirmationHeaderProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 pb-6 pt-10 text-center sm:gap-4 sm:pb-8 sm:pt-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground sm:text-base">
        {subtitle}
      </p>
    </div>
  );
}
