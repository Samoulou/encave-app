'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Wine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { signOut } from '@/lib/auth-client';

interface MobileNavProps {
  isAuthenticated: boolean;
  userName?: string | null;
  userRole?: string | null;
}

export function MobileNav({ isAuthenticated, userName, userRole }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations('nav');

  const closeMenu = () => setOpen(false);

  async function handleLogout() {
    await signOut();
    closeMenu();
    router.push('/');
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-11 w-11"
          aria-label={t('openMenu')}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[300px] sm:w-[350px] bg-cream-50"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-burgundy-600 text-white">
              <Wine className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="font-display text-xl text-burgundy-800">EnCave</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-8" aria-label={t('mainNavigation')}>
          <Link
            href="/wineries"
            onClick={closeMenu}
            className="text-lg font-medium text-slate-700 hover:text-burgundy-600 hover:bg-burgundy-50 transition-colors py-3 px-3 rounded-lg"
          >
            {t('wineries')}
          </Link>
          <Link
            href="/experiences"
            onClick={closeMenu}
            className="text-lg font-medium text-slate-700 hover:text-burgundy-600 hover:bg-burgundy-50 transition-colors py-3 px-3 rounded-lg"
          >
            {t('experiences')}
          </Link>
          <Link
            href="/about"
            onClick={closeMenu}
            className="text-lg font-medium text-slate-700 hover:text-burgundy-600 hover:bg-burgundy-50 transition-colors py-3 px-3 rounded-lg"
          >
            {t('about')}
          </Link>
          {userRole === 'ADMIN' && (
            <Link
              href="/admin"
              onClick={closeMenu}
              className="text-lg font-medium text-slate-700 hover:text-burgundy-600 hover:bg-burgundy-50 transition-colors py-3 px-3 rounded-lg"
            >
              {t('admin')}
            </Link>
          )}
          {userRole === 'WINEMAKER' && (
            <Link
              href="/dashboard"
              onClick={closeMenu}
              className="text-lg font-medium text-slate-700 hover:text-burgundy-600 hover:bg-burgundy-50 transition-colors py-3 px-3 rounded-lg"
            >
              {t('dashboard')}
            </Link>
          )}

          <div className="border-t border-stone-200 my-4" aria-hidden="true" />

          {isAuthenticated ? (
            <>
              <p className="text-sm text-slate-500 px-3">
                {t('welcome', { name: userName || t('user') })}
              </p>
              <button
                onClick={handleLogout}
                className="text-left text-lg font-medium text-slate-700 hover:text-burgundy-600 hover:bg-burgundy-50 transition-colors py-3 px-3 rounded-lg"
              >
                {t('signOut')}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-3 px-3">
              <Button variant="outline" className="h-11 w-full" asChild>
                <Link href="/login" onClick={closeMenu}>{t('signIn')}</Link>
              </Button>
              <Button className="h-11 w-full" asChild>
                <Link href="/register" onClick={closeMenu}>{t('getStarted')}</Link>
              </Button>
            </div>
          )}

          <div className="border-t border-stone-200 my-4" aria-hidden="true" />

          <div className="px-3">
            <LocaleSwitcher />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
