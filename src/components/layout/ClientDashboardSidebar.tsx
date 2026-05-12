'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, User, Menu, X, Wine } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ClientDashboardSidebarProps {
  userName?: string;
  userEmail?: string;
}

const sidebarLinks = [
  { href: '/dashboard/my-bookings', labelKey: 'myBookings', icon: Calendar },
  { href: '/dashboard/profile', labelKey: 'myProfile', icon: User },
];

export function ClientDashboardSidebar({
  userName,
  userEmail,
}: ClientDashboardSidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('clientDashboard.nav');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    sidebarLinks.forEach((link) => {
      router.prefetch(`/${locale}${link.href}`);
    });
    router.prefetch(`/${locale}`);
  }, [locale, router]);

  const handlePrefetch = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-[#e5dbdd] bg-[#f8f6f6] p-4 md:hidden">
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
          'fixed left-0 top-0 z-40 flex h-screen w-64 flex-shrink-0 flex-col justify-between border-r border-[#e5dbdd] bg-[#f8f6f6] p-4 transition-transform duration-300 ease-in-out',
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
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
                <Wine className="h-5 w-5" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">EnCave</h1>
            </Link>
          </div>

          {/* Nav Items */}
          <nav
            className="flex flex-col gap-2"
            aria-label="Dashboard navigation"
          >
            {sidebarLinks.map((link) => {
              const localizedHref = `/${locale}${link.href}`;
              const isActive =
                pathname === localizedHref ||
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
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
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
                    className={cn(
                      'text-sm',
                      isActive ? 'font-bold' : 'font-medium'
                    )}
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
          href={`/${locale}/dashboard/profile`}
          onClick={() => setIsMobileOpen(false)}
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-3 transition-all hover:border-[#e5dbdd]"
        >
          <div className="relative size-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
            <div className="flex h-full w-full items-center justify-center font-medium text-gray-500">
              {userName?.charAt(0)?.toUpperCase() || 'C'}
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-sm font-bold leading-tight">
              {userName || 'Client'}
            </p>
            <p className="truncate text-xs text-gray-500">{userEmail}</p>
          </div>
        </Link>
      </aside>
    </>
  );
}
