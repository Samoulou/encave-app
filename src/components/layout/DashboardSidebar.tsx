'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Sparkles, Building2, Menu, X, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DashboardSidebarProps {
  wineryName: string;
}

const sidebarLinks = [
  { href: '/dashboard/bookings', label: 'Bookings', icon: Calendar },
  { href: '/dashboard/earnings', label: 'Earnings', icon: TrendingUp },
  { href: '/dashboard/experiences', label: 'Experiences', icon: Sparkles },
  { href: '/dashboard/winery/profile', label: 'Winery Profile', icon: Building2 },
];

export function DashboardSidebar({ wineryName }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-24 left-4 z-50 md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
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
          'fixed left-0 top-20 z-40 h-[calc(100vh-5rem)] w-64 border-r border-stone-200 bg-white transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Winery name header */}
          <div className="border-b border-stone-200 px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Your Winery
            </p>
            <h2 className="mt-1 truncate font-display text-lg font-semibold text-burgundy-800">
              {wineryName}
            </h2>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 px-4 py-6" aria-label="Dashboard navigation">
            <ul className="space-y-1">
              {sidebarLinks.map((link) => {
                const isActive =
                  pathname === link.href || pathname.startsWith(`${link.href}/`);
                const Icon = link.icon;

                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileOpen(false)}
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
                      {link.label}
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
