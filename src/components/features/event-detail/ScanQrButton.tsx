'use client';

import { useTranslations } from 'next-intl';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigateWithTransition } from '@/hooks/useNavigateWithTransition';
import { cn } from '@/lib/utils';

interface ScanQrButtonProps {
  experienceSlug: string;
  sessionId: string;
  enabled: boolean;
  size?: 'sm' | 'default';
}

/**
 * Scan QR codes CTA — visible on every session card but disabled outside the
 * H-2 / H+2 window (Margot decision actée).
 */
export function ScanQrButton({
  experienceSlug,
  sessionId,
  enabled,
  size = 'sm',
}: ScanQrButtonProps) {
  const t = useTranslations('Dashboard.eventDetail.actions');
  const { navigate, isPending } = useNavigateWithTransition();
  const href = `/dashboard/scan?experienceSlug=${encodeURIComponent(
    experienceSlug
  )}&sessionId=${encodeURIComponent(sessionId)}`;

  if (!enabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} aria-disabled="true">
              <Button variant="outline" size={size} disabled>
                <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('scanQr')}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('scanDisabled')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      size={size}
      disabled={isPending}
      className={cn(isPending && 'opacity-70')}
      onClick={() => navigate(href)}
    >
      <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
      {t('scanQr')}
    </Button>
  );
}
