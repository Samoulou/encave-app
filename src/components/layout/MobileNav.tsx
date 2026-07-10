'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  triggerClassName?: string;
}

// P-06 (L-202): the sheet body (nav items, session state, logout) loads
// on FIRST OPEN — the initial mobile page ships only this trigger. The
// better-auth client resolves while the sheet animates in.
const MobileNavSheetBody = dynamic(
  () => import('@/components/layout/MobileNavSheetBody'),
  { ssr: false, loading: () => null }
);

export function MobileNav({ triggerClassName }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const t = useTranslations('nav');

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setHasOpened(true);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-10 w-10 rounded-full text-ink-900 md:hidden',
            triggerClassName
          )}
          aria-label={t('openMenu')}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full bg-cream-50 sm:w-[350px]">
        {hasOpened && <MobileNavSheetBody closeMenu={() => setOpen(false)} />}
      </SheetContent>
    </Sheet>
  );
}
