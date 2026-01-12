'use client';

import { useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportBookingsToCSV } from '@/server/actions/booking-dashboard';
import { toast } from 'sonner';
import { BookingStatus } from '@prisma/client';

export function ExportCSVButton() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
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

        toast.success('Bookings exported successfully');
      } else {
        toast.error(result.error.message);
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isPending}
      className="gap-2"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export CSV
    </Button>
  );
}
