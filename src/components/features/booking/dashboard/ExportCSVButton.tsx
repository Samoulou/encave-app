'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { exportBookingsToCSV } from '@/server/actions/booking-dashboard';
import { toast } from 'sonner';
import { BookingStatus } from '@prisma/client';

export function ExportCSVButton() {
  const searchParams = useSearchParams();
  const t = useTranslations('bookings');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Parse current filters from URL
      const statusParam = searchParams.get('status');
      const experienceId = searchParams.get('experience') ?? undefined;
      const dateFromParam = searchParams.get('from');
      const dateToParam = searchParams.get('to');
      const search = searchParams.get('search') ?? undefined;

      const filters = {
        status: statusParam
          ? (statusParam.split(',') as BookingStatus[])
          : undefined,
        experienceId,
        dateFrom: dateFromParam ? new Date(dateFromParam) : undefined,
        dateTo: dateToParam ? new Date(dateToParam) : undefined,
        search,
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
        toast.error(result.error.message);
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(t('toast.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 h-10 px-4 rounded-lg border border-[#e5d2d7] bg-white text-[#1a0f12] text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
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
