'use client';

import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeCardProps {
  bookingId: string;
}

export function QRCodeCard({ bookingId }: QRCodeCardProps) {
  const t = useTranslations('confirmation');
  const checkInUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/checkin/${bookingId}`
      : `/checkin/${bookingId}`;

  return (
    <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-lg border border-border">
      <div className="bg-white p-2 rounded shrink-0">
        <QRCodeSVG
          value={checkInUrl}
          size={64}
          level="M"
          includeMargin={false}
          className="size-16"
        />
      </div>
      <div className="flex flex-col">
        <p className="text-sm font-bold text-foreground">{t('checkInTicket')}</p>
        <p className="text-xs text-muted-foreground leading-tight mt-1">
          {t('presentQRCode')}
        </p>
      </div>
    </div>
  );
}
