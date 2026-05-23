'use client';

import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeCardProps {
  bookingId: string;
}

export function QRCodeCard({ bookingId }: QRCodeCardProps) {
  const t = useTranslations('confirmation');
  const checkInUrl = `/checkin/${bookingId}`;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/50 p-4 sm:flex-row sm:items-center">
      <div className="shrink-0 self-start rounded bg-white p-2">
        <QRCodeSVG
          value={checkInUrl}
          size={64}
          level="M"
          includeMargin={false}
          className="size-16"
        />
      </div>
      <div className="flex min-w-0 flex-col">
        <p className="text-sm font-bold text-foreground">
          {t('checkInTicket')}
        </p>
        <p className="mt-1 text-xs leading-tight text-muted-foreground sm:max-w-[18rem]">
          {t('presentQRCode')}
        </p>
      </div>
    </div>
  );
}
