'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Home,
  PartyPopper,
  Calendar,
  Grape,
  Inbox,
  Landmark,
  Settings,
  Menu,
  X,
  Wine,
  Wallet,
  Users,
} from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DashboardSidebarProps {
  wineryName: string;
  userName?: string;
  /** TASTING_SHEET flag (P-07) — server-resolved by the dashboard layout. */
  showWines?: boolean;
  /** REQUESTS flag (P-10) — server-resolved by the dashboard layout. */
  showRequests?: boolean;
  /** PENDING sur-mesure requests count for the nav badge (P-10). */
  requestsCount?: number;
  /**
   * COLLECTIVE_EVENTS flag AND ≥1 participation (P-11) — server-resolved.
   * Read-only view of events the winery participates in.
   */
  showCollectiveEvents?: boolean;
}

interface SidebarLink {
  href: string;
  labelKey: string;
  icon: typeof Home;
  exact?: boolean;
  /** Optional count rendered as a small badge next to the label (P-10). */
  badgeCount?: number;
}

const sidebarLinks: SidebarLink[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: Home, exact: true },
  {
    href: '/dashboard/experiences',
    labelKey: 'experiences',
    icon: PartyPopper,
  },
  { href: '/dashboard/bookings', labelKey: 'bookings', icon: Calendar },
  { href: '/dashboard/earnings', labelKey: 'earnings', icon: Wallet },
  { href: '/dashboard/payouts', labelKey: 'payouts', icon: Landmark },
  { href: '/dashboard/winery/profile', labelKey: 'wineryProfile', icon: Wine },
  { href: '/dashboard/settings', labelKey: 'settings', icon: Settings },
];

const winesLink: SidebarLink = {
  href: '/dashboard/wines',
  labelKey: 'wines',
  icon: Grape,
};

export function DashboardSidebar({
  wineryName,
  userName,
  showWines = false,
  showRequests = false,
  requestsCount = 0,
  showCollectiveEvents = false,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const currentPathname = pathname ?? '';
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('nav');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const links = useMemo(() => {
    // Insert « Vins » then « Demandes » right after « Réservations »
    // (V3 pages inventory §6), each behind its own flag.
    const bookingsIndex = sidebarLinks.findIndex(
      (link) => link.labelKey === 'bookings'
    );
    const inserted: SidebarLink[] = [];
    if (showWines) inserted.push(winesLink);
    if (showRequests) {
      inserted.push({
        href: '/dashboard/demandes',
        labelKey: 'requests',
        icon: Inbox,
        badgeCount: requestsCount,
      });
    }
    if (showCollectiveEvents) {
      inserted.push({
        href: '/dashboard/evenements-participes',
        labelKey: 'collectiveEvents',
        icon: Users,
      });
    }
    if (inserted.length === 0) return sidebarLinks;
    return [
      ...sidebarLinks.slice(0, bookingsIndex + 1),
      ...inserted,
      ...sidebarLinks.slice(bookingsIndex + 1),
    ];
  }, [showWines, showRequests, requestsCount, showCollectiveEvents]);

  // Prefetch all dashboard routes on mount for instant navigation
  useEffect(() => {
    links.forEach((link) => {
      router.prefetch(`/${locale}${link.href}`);
    });
    router.prefetch(`/${locale}`);
  }, [locale, router, links]);

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
              aria-label={t('goToHomepage')}
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
            aria-label={t('dashboardNavigation')}
          >
            {links.map((link) => {
              const localizedHref = `/${locale}${link.href}`;
              const isActive = link.exact
                ? currentPathname === localizedHref
                : currentPathname === localizedHref ||
                  currentPathname.startsWith(`${localizedHref}/`);
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
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-colors',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-primary'
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
                  {link.badgeCount != null && link.badgeCount > 0 && (
                    <span
                      className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-burgundy-700 px-1.5 text-xs font-semibold text-white"
                      aria-label={t('requestsBadge', {
                        count: link.badgeCount,
                      })}
                    >
                      {link.badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile */}
        <Link
          href={`/${locale}/dashboard/settings`}
          onClick={() => setIsMobileOpen(false)}
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-3 transition-all hover:border-[#e5dbdd]"
        >
          <div className="relative size-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
            <div className="flex h-full w-full items-center justify-center font-medium text-muted-foreground">
              {userName?.charAt(0)?.toUpperCase() || 'W'}
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-sm font-bold leading-tight">
              {userName || t('roleWinemaker')}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {wineryName}
            </p>
          </div>
        </Link>
      </aside>
    </>
  );
}
