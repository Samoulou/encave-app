'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ExportEarningsButton } from './ExportEarningsButton';

/**
 * Page header for the earnings dashboard.
 * Contains breadcrumb, title, subtitle, period selector, and export button.
 * Matches the mockup design from US-UI-10.
 */
export function EarningsPageHeader() {
  const t = useTranslations('earnings');
  const tNav = useTranslations('nav');

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb - visible on larger screens, in-page for mobile */}
      <nav className="text-sm">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/dashboard" className="text-[#915564] hover:text-primary transition-colors">
              {tNav('dashboard')}
            </Link>
          </li>
          <li className="text-[#915564]/50" aria-hidden="true">/</li>
          <li>
            <span className="font-medium text-foreground">{t('title')}</span>
          </li>
        </ol>
      </nav>

      {/* Header with title and controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-[#915564] text-base">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportEarningsButton variant="primary" />
        </div>
      </div>
    </div>
  );
}
