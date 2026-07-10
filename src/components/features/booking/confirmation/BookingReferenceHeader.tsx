import { useTranslations } from 'next-intl';
import { CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
        <Badge
          variant="success"
          className="shrink-0 gap-1.5 px-3 py-1.5 text-sm"
        >
          <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
          {t('confirmed')}
        </Badge>
      )}
    </div>
  );
}
