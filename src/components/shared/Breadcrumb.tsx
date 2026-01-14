'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  baseUrl?: string;
}

export function Breadcrumb({ items, className, baseUrl = '' }: BreadcrumbProps) {
  const locale = useLocale();

  // Helper to ensure href has locale prefix
  const getLocalizedHref = (href: string) => {
    // If href already starts with locale, return as-is
    if (href.startsWith(`/${locale}/`) || href === `/${locale}`) {
      return href;
    }
    // If href is just "/", return locale root
    if (href === '/') {
      return `/${locale}`;
    }
    // Otherwise, prefix with locale
    return `/${locale}${href}`;
  };

  // SEO-005: BreadcrumbList schema for rich snippets
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href && {
        item: `${baseUrl}${getLocalizedHref(item.href)}`,
      }),
    })),
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
    />
    <nav aria-label="Breadcrumb" className={cn('flex', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isFirst = index === 0;

          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {/* Separator */}
              {index > 0 && (
                <ChevronRight
                  className="h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
              )}

              {/* Breadcrumb item */}
              {item.href && !isLast ? (
                <Link
                  href={getLocalizedHref(item.href)}
                  className="flex items-center gap-1.5 text-slate-600 transition-colors hover:text-burgundy-700"
                >
                  {isFirst && <Home className="h-4 w-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className="flex items-center gap-1.5 font-medium text-slate-900"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {isFirst && !item.href && (
                    <Home className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="line-clamp-1">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
    </>
  );
}
