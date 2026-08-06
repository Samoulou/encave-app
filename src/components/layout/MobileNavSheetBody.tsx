'use client';

import Image from 'next/image';
import {
  Grape,
  Compass,
  Info,
  Shield,
  LayoutDashboard,
  Calendar,
  LogOut,
  Gift,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LocaleSwitcher } from '@/components/shared/LocaleSwitcher';
import { useLogout } from '@/hooks/useLogout';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

type TranslateFn = ReturnType<typeof useTranslations<'nav'>>;

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const baseNavItems = (t: TranslateFn): NavItem[] => [
  {
    href: '/wineries',
    label: t('wineries'),
    icon: <Grape className="h-5 w-5" />,
  },
  {
    href: '/experiences',
    label: t('experiences'),
    icon: <Compass className="h-5 w-5" />,
  },
  { href: '/about', label: t('about'), icon: <Info className="h-5 w-5" /> },
];

function getRoleNavItems(
  role: string | null | undefined,
  t: TranslateFn
): NavItem[] {
  switch (role) {
    case 'ADMIN':
      return [
        {
          href: '/admin',
          label: t('admin'),
          icon: <Shield className="h-5 w-5" />,
        },
      ];
    case 'WINEMAKER':
      return [
        {
          href: '/dashboard',
          label: t('dashboard'),
          icon: <LayoutDashboard className="h-5 w-5" />,
        },
      ];
    case 'CLIENT':
      return [
        {
          href: '/dashboard/my-bookings',
          label: t('myBookings'),
          icon: <Calendar className="h-5 w-5" />,
        },
      ];
    default:
      return [];
  }
}

interface MobileNavSheetBodyProps {
  closeMenu: () => void;
  /** GIFT_CARDS flag — adds the "Offrir un bon" nav item (P-09). */
  giftCardsEnabled?: boolean;
}

/**
 * Sheet content of the mobile nav — reached only via the dynamic import
 * in MobileNav, on FIRST OPEN (P-06 / L-202): the better-auth client
 * and the whole menu tree stay out of the initial mobile page load.
 * The session resolves while the sheet animates in.
 */
export default function MobileNavSheetBody({
  closeMenu,
  giftCardsEnabled = false,
}: MobileNavSheetBodyProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const logout = useLogout();
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const userName = session?.user?.name ?? null;
  const userRole = (session?.user as { role?: string | null } | undefined)
    ?.role;

  async function handleLogout() {
    await logout();
    closeMenu();
  }

  const navItems = [
    ...baseNavItems(t),
    ...(giftCardsEnabled
      ? [
          {
            href: '/cadeaux',
            label: t('giftCards'),
            icon: <Gift className="h-5 w-5" />,
          },
        ]
      : []),
    ...getRoleNavItems(userRole, t),
  ];

  return (
    <>
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
      <nav
        className="mt-8 flex flex-col gap-2"
        aria-label={t('mainNavigation')}
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 text-lg font-medium transition-colors',
                isActive
                  ? 'border-l-2 border-primary bg-primary/5 text-primary'
                  : 'text-foreground hover:bg-burgundy-50 hover:text-primary'
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

        <div className="my-4 border-t border-border" aria-hidden="true" />

        {isAuthenticated ? (
          <>
            <p className="px-3 text-sm text-muted-foreground">
              {t('welcome', { name: userName || t('user') })}
            </p>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-lg font-medium text-foreground transition-colors hover:bg-burgundy-50 hover:text-primary"
            >
              <LogOut className="h-5 w-5" />
              {t('signOut')}
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3 px-3">
            <Button variant="outline" className="h-11 w-full" asChild>
              <Link href="/login" onClick={closeMenu}>
                {t('signIn')}
              </Link>
            </Button>
            <Button className="h-11 w-full" asChild>
              <Link href="/register" onClick={closeMenu}>
                {t('getStarted')}
              </Link>
            </Button>
          </div>
        )}
      </nav>
    </>
  );
}
