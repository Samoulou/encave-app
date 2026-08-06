import { useTranslations } from 'next-intl';
import { Wine } from 'lucide-react';
import { formatCHF } from '@/lib/utils/currency';

interface BookingDetailsSectionProps {
  experienceTitle: string;
  wineryName: string;
  formattedDate: string;
  formattedTime: string;
  guestCount: number;
  totalPrice: number;
  /** Client booking fee in cents — 0 for bookings made with the flag OFF. */
  serviceFeeCents?: number;
}

export function BookingDetailsSection({
  experienceTitle,
  wineryName,
  formattedDate,
  formattedTime,
  guestCount,
  totalPrice,
  serviceFeeCents = 0,
}: BookingDetailsSectionProps) {
  const t = useTranslations('confirmation');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <Wine className="size-5 text-primary" />
          {t('experienceDetails')}
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('experience')}</p>
            <p className="text-base font-semibold text-foreground">
              {experienceTitle}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('winery')}</p>
            <p className="text-base font-semibold text-foreground">
              {wineryName}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('date')}</p>
              <p className="break-words text-base font-semibold text-foreground">
                {formattedDate}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('time')}</p>
              <p className="break-words text-base font-semibold text-foreground">
                {formattedTime}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('guests')}</p>
            <p className="text-base font-semibold text-foreground">
              {guestCount} {guestCount === 1 ? t('adult') : t('adults')}
            </p>
          </div>
        </div>
      </div>
      <div className="border-t border-border pt-4">
        {serviceFeeCents > 0 && (
          <div className="mb-2 flex items-start justify-between gap-4">
            <p className="text-sm text-muted-foreground">{t('serviceFee')}</p>
            <p className="shrink-0 text-right text-sm font-semibold text-foreground">
              {formatCHF(serviceFeeCents)}
            </p>
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <p className="text-base font-medium text-muted-foreground">
            {t('totalPaid')}
          </p>
          <p className="shrink-0 text-right text-xl font-bold text-foreground">
            {formatCHF(totalPrice + serviceFeeCents)}
          </p>
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {t('includesTaxes')}
        </p>
      </div>
    </div>
  );
}
