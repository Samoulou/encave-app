'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, ExternalLink, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { exportEarningsCSV, exportEarningsPDF } from '@/server/actions/earnings';
import { getStripeDashboardLink } from '@/server/actions/stripe';
import type { TransactionFilters } from '@/server/queries/earnings.queries';
import { cn } from '@/lib/utils';

interface ExportEarningsButtonProps {
  variant?: 'outline' | 'primary';
}

export function ExportEarningsButton({ variant = 'outline' }: ExportEarningsButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isOpeningStripe, setIsOpeningStripe] = useState(false);
  const searchParams = useSearchParams();

  const isLoading = isExporting || isExportingPDF || isOpeningStripe;

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const filters: TransactionFilters = {};

      const month = searchParams.get('month');
      if (month) filters.month = month;

      const experience = searchParams.get('experience');
      if (experience) filters.experienceId = experience;

      const status = searchParams.get('status');
      if (status) filters.status = status as TransactionFilters['status'];

      const result = await exportEarningsCSV(filters);

      if (result.success && result.data) {
        // Create and download CSV
        const blob = new Blob([result.data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success('Earnings exported successfully');
      } else if (!result.success) {
        toast.error(result.error?.message || 'Failed to export earnings');
      }
    } catch {
      toast.error('Failed to export earnings');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenStripe = async () => {
    setIsOpeningStripe(true);
    try {
      const result = await getStripeDashboardLink();

      if (result.success && result.data?.url) {
        window.open(result.data.url, '_blank');
      } else if (!result.success) {
        toast.error(result.error?.message || 'Failed to open Stripe dashboard');
      }
    } catch {
      toast.error('Failed to open Stripe dashboard');
    } finally {
      setIsOpeningStripe(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const result = await exportEarningsPDF();

      if (result.success && result.data) {
        // Decode base64 and create download
        const byteCharacters = atob(result.data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success('PDF statement downloaded successfully');
      } else if (!result.success) {
        toast.error(result.error?.message || 'Failed to generate PDF');
      }
    } catch {
      toast.error('Failed to generate PDF statement');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const isPrimary = variant === 'primary';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isPrimary ? 'default' : 'outline'}
          size={isPrimary ? 'default' : 'sm'}
          disabled={isLoading}
          className={
            isPrimary
              ? 'gap-2 bg-primary hover:bg-primary/90 text-white font-bold shadow-md hover:shadow-lg active:scale-95 transition-all'
              : ''
          }
        >
          {isLoading ? (
            <Loader2 className={cn('h-4 w-4 animate-spin', !isPrimary && 'mr-2')} />
          ) : (
            <Download className={cn('h-4 w-4', !isPrimary && 'mr-2')} />
          )}
          <span className="text-sm">{isPrimary ? 'Export Report' : 'Export'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportPDF} disabled={isExportingPDF}>
          <FileText className="mr-2 h-4 w-4" />
          Download PDF Statement
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpenStripe} disabled={isOpeningStripe}>
          <ExternalLink className="mr-2 h-4 w-4" />
          View in Stripe
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
