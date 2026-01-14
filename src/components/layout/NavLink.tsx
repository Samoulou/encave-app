'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
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
        'text-sm font-medium transition-colors',
        isActive
          ? activeClassName || 'text-burgundy-700'
          : 'text-slate-600 hover:text-burgundy-700',
        className
      )}
    >
      {children}
    </Link>
  );
}
