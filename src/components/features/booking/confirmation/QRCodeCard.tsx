'use client';

import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeCardProps {
  /**
   * Absolute token-gated ticket URL (same target as the email QR, accepted
   * by the winery scanner). Only available when the confirmation page won
   * the confirmation race — the plaintext token is never recoverable later.
   */
  ticketUrl?: string;
}

export function QRCodeCard({ ticketUrl }: QRCodeCardProps) {
  const t = useTranslations('confirmation');

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/50 p-4 sm:flex-row sm:items-center">
      {ticketUrl ? (
        <div className="shrink-0 self-start rounded bg-white p-2">
          <QRCodeSVG
            value={ticketUrl}
            size={64}
            level="M"
            includeMargin={false}
            className="size-16"
          />
        </div>
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center self-start rounded bg-white p-2">
          <Mail className="size-8 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <p className="text-sm font-bold text-foreground">
          {t('checkInTicket')}
        </p>
        <p className="mt-1 text-xs leading-tight text-muted-foreground sm:max-w-[18rem]">
          {ticketUrl ? t('presentQRCode') : t('qrCodeInEmail')}
        </p>
      </div>
    </div>
  );
}
