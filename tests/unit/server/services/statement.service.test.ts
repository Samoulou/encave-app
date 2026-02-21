import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @react-pdf/renderer
vi.mock('@react-pdf/renderer', () => ({
  Document: vi.fn(({ children }: { children: unknown }) => children),
  Page: vi.fn(({ children }: { children: unknown }) => children),
  Text: vi.fn(({ children }: { children: unknown }) => children),
  View: vi.fn(({ children }: { children: unknown }) => children),
  StyleSheet: { create: vi.fn((styles: unknown) => styles) },
  renderToBuffer: vi.fn(),
}));

import { renderToBuffer } from '@react-pdf/renderer';
import type { YearToDateSummary, Transaction } from '@/server/queries/earnings.queries';

// Import after mocks (file is .tsx)
const { generateEarningsStatementPDF } = await import(
  '@/server/services/statement.service'
);

const mockRenderToBuffer = vi.mocked(renderToBuffer);

describe('Statement Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSummary: YearToDateSummary = {
    grossRevenue: 500000,
    platformFees: 60000,
    netEarnings: 440000,
    totalBookings: 25,
    refundedAmount: 10000,
  };

  const mockTransactions: Transaction[] = [
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
      status: 'paid',
      reference: 'REF-001',
      estimatedPayoutDate: null,
    },
    {
      id: 't-2',
      date: new Date('2025-04-10'),
      bookingId: 'b-2',
      experienceTitle: 'Cellar Tour',
      experienceId: 'exp-2',
      customer: { name: 'Jane' },
      guestCount: 2,
      grossAmount: 10000,
      platformFee: 1200,
      netPayout: 8800,
      status: 'processing',
      reference: 'REF-002',
      estimatedPayoutDate: new Date('2025-04-17'),
    },
  ];

  describe('generateEarningsStatementPDF', () => {
    it('generates a PDF buffer', async () => {
      const fakeBuffer = Buffer.from('fake-pdf-content');
      mockRenderToBuffer.mockResolvedValueOnce(fakeBuffer as never);

      const result = await generateEarningsStatementPDF(
        'Test Winery',
        2025,
        mockSummary,
        mockTransactions
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('fake-pdf-content');
    });

    it('calls renderToBuffer with a React element', async () => {
      mockRenderToBuffer.mockResolvedValueOnce(Buffer.from('') as never);

      await generateEarningsStatementPDF(
        'Test Winery',
        2025,
        mockSummary,
        mockTransactions
      );

      expect(mockRenderToBuffer).toHaveBeenCalledTimes(1);
    });

    it('handles empty transactions', async () => {
      mockRenderToBuffer.mockResolvedValueOnce(Buffer.from('empty-pdf') as never);

      const result = await generateEarningsStatementPDF(
        'Test Winery',
        2025,
        { ...mockSummary, totalBookings: 0, grossRevenue: 0, platformFees: 0, netEarnings: 0 },
        []
      );

      expect(result).toBeInstanceOf(Buffer);
    });

    it('propagates renderToBuffer errors', async () => {
      mockRenderToBuffer.mockRejectedValueOnce(new Error('Render failed'));

      await expect(
        generateEarningsStatementPDF('Test Winery', 2025, mockSummary, mockTransactions)
      ).rejects.toThrow('Render failed');
    });
  });
});
