import { useTranslations } from 'next-intl';
import { CheckCircle } from 'lucide-react';

interface BookingReferenceHeaderProps {
  reference: string;
  isConfirmed: boolean;
}

export function BookingReferenceHeader({
  reference,
  isConfirmed,
}: BookingReferenceHeaderProps) {
  const t = useTranslations('confirmation');

  return (
    <div className="flex flex-col items-start justify-between gap-4 border-b border-border bg-muted/50 p-6 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {t('bookingReference')}
        </p>
        <p className="break-all text-2xl font-bold tracking-tight text-primary">
          {reference}
        </p>
      </div>
      {isConfirmed && (
        <div className="flex shrink-0 items-center gap-2 rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-700">
          <CheckCircle className="size-4 shrink-0" />
          {t('confirmed')}
        </div>
      )}
    </div>
  );
}
