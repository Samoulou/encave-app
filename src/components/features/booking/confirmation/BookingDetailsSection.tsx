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
}

export function BookingDetailsSection({
  experienceTitle,
  wineryName,
  formattedDate,
  formattedTime,
  guestCount,
  totalPrice,
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
          <div className="flex gap-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('date')}</p>
              <p className="text-base font-semibold text-foreground">
                {formattedDate}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('time')}</p>
              <p className="text-base font-semibold text-foreground">
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
        <div className="flex items-center justify-between">
          <p className="text-base font-medium text-muted-foreground">
            {t('totalPaid')}
          </p>
          <p className="text-xl font-bold text-foreground">
            {formatCHF(totalPrice)}
          </p>
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {t('includesTaxes')}
        </p>
      </div>
    </div>
  );
}
