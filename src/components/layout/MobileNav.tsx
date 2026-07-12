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
  {
    ssr: false,
    // Visible while the chunk downloads on a slow connection — never an
    // empty sheet (P-06 review).
    loading: () => (
      <div className="mt-8 space-y-3" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-11 animate-pulse rounded-lg bg-stone-200/70"
          />
        ))}
      </div>
    ),
  }
);

export function MobileNav({ triggerClassName }: MobileNavProps) {
  // Radix unmounts SheetContent's subtree while closed: rendering the
  // body unconditionally still only loads the chunk on first open.
  const [open, setOpen] = useState(false);
  const t = useTranslations('nav');

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
        <MobileNavSheetBody closeMenu={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
