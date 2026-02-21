import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from '@/server/auth';

// Mock auth
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn() },
  },
}));

// Mock earnings queries
vi.mock('@/server/queries/earnings.queries', () => ({
  getTransactions: vi.fn(),
  getYearToDateSummary: vi.fn(),
}));

// Mock statement service
vi.mock('@/server/services/statement.service', () => ({
  generateEarningsStatementPDF: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { getTransactions, getYearToDateSummary } from '@/server/queries/earnings.queries';
import { generateEarningsStatementPDF } from '@/server/services/statement.service';
import {
  exportEarningsCSV,
  exportEarningsPDF,
} from '@/server/actions/earnings';

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);
const mockGetTransactions = vi.mocked(getTransactions);
const mockGetYearToDateSummary = vi.mocked(getYearToDateSummary);
const mockGeneratePDF = vi.mocked(generateEarningsStatementPDF);

describe('Earnings Actions', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'winemaker@test.com',
      name: 'Test User',
      role: 'WINEMAKER',
      preferredLocale: 'FR',
    },
  };

  const mockWinery = { id: 'winery-123', name: 'Test Winery' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // exportEarningsCSV
  // ========================================
  describe('exportEarningsCSV', () => {
    const mockTransactions = [
      {
        id: 't-1',
        date: new Date('2025-03-15'),
        bookingId: 'b-1',
        experienceTitle: 'Wine Tasting',
        experienceId: 'exp-1',
        customer: { name: 'John' },
        guestCount: 4,
        grossAmount: 20000,
        platformFee: 2400,
        netPayout: 17600,
        status: 'paid' as const,
        reference: 'REF-001',
        estimatedPayoutDate: null,
      },
    ];

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await exportEarningsCSV();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await exportEarningsCSV();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('successfully exports CSV with transactions', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockGetTransactions.mockResolvedValueOnce(mockTransactions as never);

      const result = await exportEarningsCSV();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.csv).toContain('Date,Experience,Reference');
        expect(result.data.csv).toContain('Wine Tasting');
        expect(result.data.csv).toContain('200.00'); // grossAmount / 100
        expect(result.data.filename).toContain('earnings-test-winery');
        expect(result.data.filename).toContain('.csv');
      }
    });

    it('passes filters to getTransactions', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockGetTransactions.mockResolvedValueOnce([] as never);

      const filters = { month: '2025-03', status: 'paid' as const };
      await exportEarningsCSV(filters);

      expect(mockGetTransactions).toHaveBeenCalledWith('winery-123', filters);
    });

    it('handles empty transactions', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockGetTransactions.mockResolvedValueOnce([] as never);

      const result = await exportEarningsCSV();

      expect(result.success).toBe(true);
      if (result.success) {
        // Only header row
        expect(result.data.csv.split('\n')).toHaveLength(1);
      }
    });

    it('returns INTERNAL_ERROR on failure', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockRejectedValueOnce(new Error('DB error'));

      const result = await exportEarningsCSV();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  // ========================================
  // exportEarningsPDF
  // ========================================
  describe('exportEarningsPDF', () => {
    const mockSummary = {
      grossRevenue: 100000,
      platformFees: 12000,
      netEarnings: 88000,
      totalBookings: 10,
      refundedAmount: 0,
    };

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await exportEarningsPDF();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await exportEarningsPDF();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('successfully generates PDF', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockGetYearToDateSummary.mockResolvedValueOnce(mockSummary as never);
      mockGetTransactions.mockResolvedValueOnce([] as never);
      mockGeneratePDF.mockResolvedValueOnce(Buffer.from('fake-pdf') as never);

      const result = await exportEarningsPDF();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pdf).toBeTruthy();
        expect(result.data.filename).toContain('earnings-statement');
        expect(result.data.filename).toContain('.pdf');
      }
    });

    it('returns INTERNAL_ERROR on failure', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockGetYearToDateSummary.mockRejectedValueOnce(new Error('Query error'));

      const result = await exportEarningsPDF();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
