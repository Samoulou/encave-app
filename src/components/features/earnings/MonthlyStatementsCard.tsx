import { getLocale, getTranslations } from 'next-intl/server';
import { FileText, Download } from 'lucide-react';
import { subMonths, format } from 'date-fns';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';

const MONTHS_SHOWN = 12;

/**
 * Monthly statement downloads (P-13 / L-142) — the last 12 months as
 * direct links to the PDF route. Plain <a>: the /api route lives outside
 * the locale tree, and the browser handles the attachment download.
 */
export async function MonthlyStatementsCard() {
  const [t, locale] = await Promise.all([
    getTranslations('earnings.statements'),
    getLocale() as Promise<Locale>,
  ]);

  const now = new Date();
  const months = Array.from({ length: MONTHS_SHOWN }, (_, index) => {
    const date = subMonths(now, index);
    return {
      key: format(date, 'yyyy-MM'),
      label: formatDate(date, locale, { month: 'long', year: 'numeric' }),
    };
  });

  return (
    <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="font-medium text-foreground">{t('title')}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((month) => (
          <li key={month.key}>
            <a
              href={`/api/dashboard/statements/${month.key}?locale=${locale}`}
              download
              className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-primary-light"
            >
              <span className="capitalize">{month.label}</span>
              <Download
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
