'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Home,
  PartyPopper,
  Calendar,
  Settings,
  Menu,
  X,
  Wine,
  Wallet,
} from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DashboardSidebarProps {
  wineryName: string;
  userName?: string;
}

const sidebarLinks = [
  { href: '/dashboard', labelKey: 'dashboard', icon: Home, exact: true },
  { href: '/dashboard/experiences', labelKey: 'experiences', icon: PartyPopper },
  { href: '/dashboard/bookings', labelKey: 'bookings', icon: Calendar },
  { href: '/dashboard/earnings', labelKey: 'earnings', icon: Wallet },
  { href: '/dashboard/settings', labelKey: 'settings', icon: Settings },
];

export function DashboardSidebar({
  wineryName,
  userName,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('nav');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Prefetch all dashboard routes on mount for instant navigation
  useEffect(() => {
    sidebarLinks.forEach((link) => {
      router.prefetch(`/${locale}${link.href}`);
    });
    router.prefetch(`/${locale}`);
  }, [locale, router]);

  // Prefetch on hover for immediate response
  const handlePrefetch = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 border-b border-[#e5dbdd] bg-[#f8f6f6]">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <Wine className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-bold">EnCave</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label={isMobileOpen ? t('closeMenu') : t('openMenu')}
        >
          {isMobileOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 flex-shrink-0 border-r border-[#e5dbdd] bg-[#f8f6f6] flex flex-col justify-between p-4 transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col gap-8">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-3"
              aria-label="Go to homepage"
            >
              <div className="flex items-center justify-center size-10 rounded-xl bg-primary text-white">
                <Wine className="h-5 w-5" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">EnCave</h1>
            </Link>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-2" aria-label="Dashboard navigation">
            {sidebarLinks.map((link) => {
              const localizedHref = `/${locale}${link.href}`;
              const isActive = link.exact
                ? pathname === localizedHref
                : pathname === localizedHref ||
                  pathname.startsWith(`${localizedHref}/`);
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={localizedHref}
                  prefetch={true}
                  onClick={() => setIsMobileOpen(false)}
                  onMouseEnter={() => handlePrefetch(localizedHref)}
                  onFocus={() => handlePrefetch(localizedHref)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-colors',
                      isActive
                        ? 'text-primary'
                        : 'text-gray-500 group-hover:text-primary'
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn('text-sm', isActive ? 'font-bold' : 'font-medium')}
                  >
                    {t(link.labelKey)}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile */}
        <Link
          href={`/${locale}/dashboard/settings`}
          onClick={() => setIsMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-3 rounded-lg border border-transparent hover:border-[#e5dbdd] cursor-pointer transition-all"
        >
          <div className="relative size-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
              {userName?.charAt(0)?.toUpperCase() || 'W'}
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-bold leading-tight truncate">
              {userName || 'Winemaker'}
            </p>
            <p className="text-xs text-gray-500 truncate">{wineryName}</p>
          </div>
        </Link>
      </aside>
    </>
  );
}
