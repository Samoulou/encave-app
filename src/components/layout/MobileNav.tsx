'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Menu,
  Grape,
  Compass,
  Info,
  Shield,
  LayoutDashboard,
  Calendar,
  LogOut,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { useLogout } from '@/hooks/useLogout';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  isAuthenticated: boolean;
  userName?: string | null;
  userRole?: string | null;
}

type TranslateFn = ReturnType<typeof useTranslations<'nav'>>;

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const baseNavItems = (t: TranslateFn): NavItem[] => [
  { href: '/wineries', label: t('wineries'), icon: <Grape className="h-5 w-5" /> },
  { href: '/experiences', label: t('experiences'), icon: <Compass className="h-5 w-5" /> },
  { href: '/about', label: t('about'), icon: <Info className="h-5 w-5" /> },
];

function getRoleNavItems(role: string | null | undefined, t: TranslateFn): NavItem[] {
  switch (role) {
    case 'ADMIN':
      return [{ href: '/admin', label: t('admin'), icon: <Shield className="h-5 w-5" /> }];
    case 'WINEMAKER':
      return [{ href: '/dashboard', label: t('dashboard'), icon: <LayoutDashboard className="h-5 w-5" /> }];
    case 'CLIENT':
      return [{ href: '/dashboard/my-bookings', label: t('myBookings'), icon: <Calendar className="h-5 w-5" /> }];
    default:
      return [];
  }
}

export function MobileNav({ isAuthenticated, userName, userRole }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('nav');
  const pathname = usePathname();
  const logout = useLogout();

  const closeMenu = () => setOpen(false);

  async function handleLogout() {
    await logout();
    closeMenu();
  }

  const navItems = [...baseNavItems(t), ...getRoleNavItems(userRole, t)];

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
            <Image
              src="/icons/encave-logo.png"
              alt="EnCave"
              width={140}
              height={40}
              className="h-10 w-auto"
            />
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-8" aria-label={t('mainNavigation')}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className={cn(
                  'flex items-center gap-3 text-lg font-medium transition-colors py-3 px-3 rounded-lg',
                  isActive
                    ? 'text-primary bg-primary/5 border-l-2 border-primary'
                    : 'text-foreground hover:text-primary hover:bg-burgundy-50'
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}

          <div className="px-3 py-2">
            <LocaleSwitcher />
          </div>

          <div className="border-t border-border my-4" aria-hidden="true" />

          {isAuthenticated ? (
            <>
              <p className="text-sm text-muted-foreground px-3">
                {t('welcome', { name: userName || t('user') })}
              </p>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 text-left text-lg font-medium text-foreground hover:text-primary hover:bg-burgundy-50 transition-colors py-3 px-3 rounded-lg"
              >
                <LogOut className="h-5 w-5" />
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
        </nav>
      </SheetContent>
    </Sheet>
  );
}
