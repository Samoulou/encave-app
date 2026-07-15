import { useTranslations, useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';
import type { AdminHistoryEntry } from '@/server/queries/admin-wineries.queries';

interface AdminActionHistoryProps {
  entries: AdminHistoryEntry[];
}

/**
 * Presentational timeline of admin/verification actions (P-15 / L-161-162):
 * the first surface to READ AdminAction / VerificationLog. Tolerates a null
 * reason/status and unknown action codes — internal codes are shown verbatim
 * (the admin surface is functional-before-pretty).
 */
export function AdminActionHistory({ entries }: AdminActionHistoryProps) {
  const t = useTranslations('admin.history');
  const locale = useLocale() as Locale;

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-stone-100 pb-3 text-sm last:border-0"
        >
          <Badge
            variant={entry.status === 'FAILED' ? 'destructive' : 'outline'}
          >
            {entry.action}
          </Badge>
          <span className="text-muted-foreground">
            {formatDateTime(entry.at, locale)}
          </span>
          {entry.reason && (
            <span className="text-foreground">« {entry.reason} »</span>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {t('by')} {entry.adminId}
          </span>
        </li>
      ))}
    </ul>
  );
}
