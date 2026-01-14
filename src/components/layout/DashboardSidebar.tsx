'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Sparkles, Building2, Menu, X, TrendingUp, Settings, Home, Wine } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DashboardSidebarProps {
  wineryName: string;
}

const sidebarLinks = [
  { href: '/dashboard/bookings', labelKey: 'bookings', icon: Calendar },
  { href: '/dashboard/earnings', labelKey: 'earnings', icon: TrendingUp },
  { href: '/dashboard/experiences', labelKey: 'experiences', icon: Sparkles },
  { href: '/dashboard/winery/profile', labelKey: 'wineryProfile', icon: Building2 },
  { href: '/dashboard/settings/notifications', labelKey: 'settings', icon: Settings },
];

export function DashboardSidebar({ wineryName }: DashboardSidebarProps) {
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
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-24 left-4 z-50 md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? t('closeMenu') : t('openMenu')}
      >
        {isMobileOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </Button>

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
          'fixed left-0 top-0 z-40 h-screen w-64 border-r border-stone-200 bg-white transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo header - links to home */}
          <div className="border-b border-stone-200 px-6 py-4">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 group"
              aria-label="Go to homepage"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-burgundy-600 text-white transition-colors group-hover:bg-burgundy-700">
                <Wine className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="font-display text-xl font-semibold text-burgundy-800">
                EnCave
              </span>
            </Link>
          </div>

          {/* Winery name */}
          <div className="border-b border-stone-200 px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t('yourWinery')}
            </p>
            <h2 className="mt-1 truncate font-display text-lg font-semibold text-burgundy-800">
              {wineryName}
            </h2>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 px-4 py-6" aria-label="Dashboard navigation">
            <ul className="space-y-1">
              {/* Home link */}
              <li>
                <Link
                  href={`/${locale}`}
                  prefetch={true}
                  onClick={() => setIsMobileOpen(false)}
                  onMouseEnter={() => handlePrefetch(`/${locale}`)}
                  onFocus={() => handlePrefetch(`/${locale}`)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-stone-50 hover:text-burgundy-700 transition-colors"
                >
                  <Home
                    className="h-5 w-5 flex-shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  {t('backToHome')}
                </Link>
              </li>

              <li className="pt-2">
                <div className="border-t border-stone-200 pt-3" />
              </li>

              {sidebarLinks.map((link) => {
                const localizedHref = `/${locale}${link.href}`;
                const isActive =
                  pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);
                const Icon = link.icon;

                return (
                  <li key={link.href}>
                    <Link
                      href={localizedHref}
                      prefetch={true}
                      onClick={() => setIsMobileOpen(false)}
                      onMouseEnter={() => handlePrefetch(localizedHref)}
                      onFocus={() => handlePrefetch(localizedHref)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-burgundy-50 text-burgundy-700'
                          : 'text-slate-600 hover:bg-stone-50 hover:text-burgundy-700'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5 flex-shrink-0',
                          isActive ? 'text-burgundy-600' : 'text-slate-400'
                        )}
                        aria-hidden="true"
                      />
                      {t(link.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
