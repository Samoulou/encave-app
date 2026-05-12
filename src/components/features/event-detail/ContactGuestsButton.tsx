'use client';

import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Contact-all-guests button. Disabled in MVP (ENC-097 P1 will wire it).
 * Wrapped in a span so the tooltip still works on a disabled button.
 */
export function ContactGuestsButton() {
  const t = useTranslations('Dashboard.eventDetail.actions');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-disabled="true">
            <Button variant="outline" size="sm" disabled>
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('contactAll')}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('contactAllSoon')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
