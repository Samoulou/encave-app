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
    <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/50">
      <div>
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
          {t('bookingReference')}
        </p>
        <p className="text-2xl font-bold text-primary tracking-tight">
          {reference}
        </p>
      </div>
      {isConfirmed && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
          <CheckCircle className="size-4" />
          {t('confirmed')}
        </div>
      )}
    </div>
  );
}
