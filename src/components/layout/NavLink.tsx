'use client';

import { useCallback } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  /** Enable prefetch on hover/focus (default: true) */
  prefetch?: boolean;
}

export function NavLink({
  href,
  children,
  className,
  activeClassName,
  prefetch = true,
}: NavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  const handlePrefetch = useCallback(() => {
    if (prefetch) {
      router.prefetch(href);
    }
  }, [href, prefetch, router]);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      className={cn(
        'relative text-sm font-medium transition-colors group',
        isActive
          ? activeClassName || 'text-burgundy-700'
          : 'text-slate-600 hover:text-burgundy-700',
        className
      )}
    >
      {children}
      {/* Animated underline indicator */}
      <span
        className={cn(
          'absolute -bottom-1 left-0 h-0.5 rounded-full bg-gradient-to-r from-primary to-gold-400 transition-all duration-300 ease-premium',
          isActive ? 'w-full' : 'w-0 group-hover:w-full'
        )}
        aria-hidden="true"
      />
    </Link>
  );
}
