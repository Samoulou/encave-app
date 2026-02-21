'use server';

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { format } from 'date-fns';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';
import {
  getTransactions,
  getYearToDateSummary,
  type TransactionFilters,
} from '@/server/queries/earnings.queries';
import { generateEarningsStatementPDF } from '@/server/services/statement.service';

interface ExportCSVResult {
  csv: string;
  filename: string;
}

/**
 * Export earnings transactions to CSV
 */
export async function exportEarningsCSV(
  filters?: TransactionFilters
): Promise<ActionResult<ExportCSVResult>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true, name: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    const transactions = await getTransactions(winery.id, filters);

    // Build CSV
    const headers = [
      'Date',
      'Experience',
      'Reference',
      'Guests',
      'Gross Amount (CHF)',
      'Platform Fee (CHF)',
      'Net Payout (CHF)',
      'Status',
    ];

    const rows = transactions.map((t) => [
      format(t.date, 'yyyy-MM-dd'),
      `"${t.experienceTitle.replace(/"/g, '""')}"`,
      t.reference,
      t.guestCount.toString(),
      (t.grossAmount / 100).toFixed(2),
      (t.platformFee / 100).toFixed(2),
      (t.netPayout / 100).toFixed(2),
      t.status.charAt(0).toUpperCase() + t.status.slice(1),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `earnings-${winery.name.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.csv`;

    return {
      success: true,
      data: { csv, filename },
    };
  } catch (error) {
    logError('exportEarningsCSV error', error, { action: 'exportEarningsCSV' });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to export earnings. Please try again.',
      },
    };
  }
}

interface ExportPDFResult {
  pdf: string; // Base64 encoded PDF
  filename: string;
}

/**
 * Export earnings statement to PDF
 */
export async function exportEarningsPDF(): Promise<ActionResult<ExportPDFResult>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Please sign in to continue' },
      };
    }

    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true, name: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Winery not found' },
      };
    }

    const currentYear = new Date().getFullYear();

    // Get YTD data for the statement
    const [summary, transactions] = await Promise.all([
      getYearToDateSummary(winery.id),
      getTransactions(winery.id), // All transactions for the year
    ]);

    // Filter transactions to current year
    const yearTransactions = transactions.filter(
      (t) => t.date.getFullYear() === currentYear
    );

    // Generate PDF
    const pdfBuffer = await generateEarningsStatementPDF(
      winery.name,
      currentYear,
      summary,
      yearTransactions
    );

    // Convert to base64 for transfer
    const pdf = pdfBuffer.toString('base64');

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `earnings-statement-${winery.name.replace(/\s+/g, '-').toLowerCase()}-${currentYear}-${dateStr}.pdf`;

    return {
      success: true,
      data: { pdf, filename },
    };
  } catch (error) {
    logError('exportEarningsPDF error', error, { action: 'exportEarningsPDF' });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate PDF statement. Please try again.',
      },
    };
  }
}
