'use client';

import { useState } from 'react';
import { parseAsArrayOf, parseAsString, useQueryStates } from 'nuqs';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { exportBookingsToCSV } from '@/server/actions/booking-dashboard';
import { toast } from 'sonner';
import { BookingStatus } from '@prisma/client';
import { useActionErrorMessage } from '@/hooks/useActionErrorMessage';

// Same URL keys as BookingFilters / BookingSearch — read-only here. `page`
// is deliberately absent: the export is the FULL filtered set, never the
// page on screen.
const exportFilterParsers = {
  status: parseAsArrayOf(parseAsString),
  experience: parseAsString,
  from: parseAsString,
  to: parseAsString,
  search: parseAsString,
};

export function ExportCSVButton() {
  const [urlFilters] = useQueryStates(exportFilterParsers);
  const t = useTranslations('bookings');
  const actionError = useActionErrorMessage();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Current filters from the URL (the server re-validates them).
      const filters = {
        status:
          urlFilters.status && urlFilters.status.length > 0
            ? (urlFilters.status as BookingStatus[])
            : undefined,
        experienceId: urlFilters.experience ?? undefined,
        dateFrom: urlFilters.from ? new Date(urlFilters.from) : undefined,
        dateTo: urlFilters.to ? new Date(urlFilters.to) : undefined,
        search: urlFilters.search ?? undefined,
      };

      const result = await exportBookingsToCSV(filters);

      if (result.success) {
        // Create blob and trigger download
        const blob = new Blob([result.data.csvData], {
          type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(t('toast.exportSuccess'));
      } else {
        toast.error(actionError(result.error));
      }
    } catch {
      // Network failure or a thrown action — the toast is the user signal;
      // server-side failures are already logged by the action itself.
      toast.error(t('toast.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      {isExporting ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Download className="h-5 w-5" />
      )}
      <span>{t('export.csv')}</span>
    </button>
  );
}
