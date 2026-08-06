import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingStatus } from '@prisma/client';

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    booking: { findMany: vi.fn() },
    winery: { findUnique: vi.fn() },
    experience: { findMany: vi.fn() },
  },
}));

// Mock React cache (pass-through)
vi.mock('react', () => ({
  cache: (fn: Function) => fn,
}));

import { db } from '@/server/db';
import {
  getEarningsSummary,
  getMonthlyEarnings,
  getTransactions,
  getYearToDateSummary,
  getMonthlyStatementData,
} from '@/server/queries/earnings.queries';

const mockDb = vi.mocked(db);

describe('Earnings Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Set system time to Wednesday, January 14, 2026 at 12:00 UTC
    vi.setSystemTime(new Date('2026-01-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ========================================
  // getEarningsSummary
  // ========================================
  describe('getEarningsSummary', () => {
    it('returns summary with zero earnings when no bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      const result = await getEarningsSummary('winery-123');

      expect(result.totalEarnings).toBe(0);
      expect(result.thisMonth).toBe(0);
      expect(result.lastMonth).toBe(0);
      expect(result.yearToDate).toBe(0);
      expect(result.currentMonthLabel).toBe('Jan');
    });

    it('calculates total earnings from past non-refunded bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          wineryPayout: 5000,
          totalPrice: 6000,
          serviceFeeCents: 0,
          date: new Date('2026-01-04T10:00:00Z'),
          status: BookingStatus.COMPLETED,
          refundIssued: false,
          refundAmount: null,
        },
        {
          wineryPayout: 3000,
          totalPrice: 3600,
          serviceFeeCents: 0,
          date: new Date('2025-12-20T10:00:00Z'),
          status: BookingStatus.CONFIRMED,
          refundIssued: false,
          refundAmount: null,
        },
      ] as never);

      const result = await getEarningsSummary('winery-123');

      expect(result.totalEarnings).toBe(8000);
    });

    it('excludes refunded bookings from total earnings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          wineryPayout: 5000,
          totalPrice: 6000,
          serviceFeeCents: 0,
          date: new Date('2026-01-04T10:00:00Z'),
          status: BookingStatus.COMPLETED,
          refundIssued: false,
          refundAmount: null,
        },
        {
          wineryPayout: 3000,
          totalPrice: 3600,
          serviceFeeCents: 0,
          date: new Date('2026-01-04T10:00:00Z'),
          status: BookingStatus.COMPLETED,
          refundIssued: true,
          refundAmount: 3600,
        },
      ] as never);

      const result = await getEarningsSummary('winery-123');

      expect(result.totalEarnings).toBe(5000);
    });

    it('excludes future bookings from total earnings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          wineryPayout: 5000,
          totalPrice: 6000,
          serviceFeeCents: 0,
          date: new Date('2026-01-04T10:00:00Z'), // Past
          status: BookingStatus.COMPLETED,
          refundIssued: false,
          refundAmount: null,
        },
        {
          wineryPayout: 3000,
          totalPrice: 3600,
          serviceFeeCents: 0,
          date: new Date('2026-02-15T10:00:00Z'), // Future
          status: BookingStatus.CONFIRMED,
          refundIssued: false,
          refundAmount: null,
        },
      ] as never);

      const result = await getEarningsSummary('winery-123');

      expect(result.totalEarnings).toBe(5000);
    });

    it('calculates this month earnings from current month past experiences only', async () => {
      // System time: 2026-01-14
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          wineryPayout: 5000,
          totalPrice: 6000,
          serviceFeeCents: 0,
          date: new Date('2026-01-10T10:00:00Z'), // This month, past
          status: BookingStatus.COMPLETED,
          refundIssued: false,
          refundAmount: null,
        },
        {
          wineryPayout: 3000,
          totalPrice: 3500,
          serviceFeeCents: 0,
          date: new Date('2026-01-20T10:00:00Z'), // This month, future
          status: BookingStatus.CONFIRMED,
          refundIssued: false,
          refundAmount: null,
        },
        {
          wineryPayout: 2000,
          totalPrice: 2500,
          serviceFeeCents: 0,
          date: new Date('2025-12-15T10:00:00Z'), // Last month
          status: BookingStatus.COMPLETED,
          refundIssued: false,
          refundAmount: null,
        },
      ] as never);

      const result = await getEarningsSummary('winery-123');

      // Only this month AND past: 5000
      expect(result.thisMonth).toBe(5000);
    });

    it('calculates last month earnings excluding refunded', async () => {
      // System time: 2026-01-14, last month = Dec 2025
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          wineryPayout: 2000,
          totalPrice: 2500,
          serviceFeeCents: 0,
          date: new Date('2025-12-10T10:00:00Z'), // Last month
          status: BookingStatus.COMPLETED,
          refundIssued: false,
          refundAmount: null,
        },
        {
          wineryPayout: 3000,
          totalPrice: 3500,
          serviceFeeCents: 0,
          date: new Date('2025-12-20T10:00:00Z'), // Last month
          status: BookingStatus.CONFIRMED,
          refundIssued: false,
          refundAmount: null,
        },
        {
          wineryPayout: 1000,
          totalPrice: 1200,
          serviceFeeCents: 0,
          date: new Date('2025-12-25T10:00:00Z'), // Last month but refunded
          status: BookingStatus.COMPLETED,
          refundIssued: true,
          refundAmount: 3600,
        },
      ] as never);

      const result = await getEarningsSummary('winery-123');

      // Last month non-refunded: 2000 + 3000 = 5000
      expect(result.lastMonth).toBe(5000);
    });

    it('calculates year-to-date as gross revenue (totalPrice)', async () => {
      // System time: 2026-01-14
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          wineryPayout: 8500,
          totalPrice: 10000,
          serviceFeeCents: 0,
          date: new Date('2026-01-05T10:00:00Z'), // This year, past
          status: BookingStatus.COMPLETED,
          refundIssued: false,
          refundAmount: null,
        },
        {
          wineryPayout: 4200,
          totalPrice: 5000,
          serviceFeeCents: 0,
          date: new Date('2026-01-10T10:00:00Z'), // This year, past
          status: BookingStatus.CONFIRMED,
          refundIssued: false,
          refundAmount: null,
        },
        {
          wineryPayout: 6000,
          totalPrice: 7000,
          serviceFeeCents: 0,
          date: new Date('2025-11-10T10:00:00Z'), // Last year
          status: BookingStatus.COMPLETED,
          refundIssued: false,
          refundAmount: null,
        },
      ] as never);

      const result = await getEarningsSummary('winery-123');

      // YTD uses totalPrice (gross), only 2026 bookings that have passed: 10000 + 5000 = 15000
      expect(result.yearToDate).toBe(15000);
    });

    it('returns current month label', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      const result = await getEarningsSummary('winery-123');

      expect(result.currentMonthLabel).toBe('Jan');
    });

    it('queries bookings with correct where clause', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getEarningsSummary('winery-123');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith({
        where: {
          wineryId: 'winery-123',
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
        select: {
          wineryPayout: true,
          totalPrice: true,
          serviceFeeCents: true,
          refundAmount: true,
          date: true,
          status: true,
          refundIssued: true,
        },
      });
    });
  });

  // ========================================
  // getMonthlyEarnings
  // ========================================
  describe('getMonthlyEarnings', () => {
    it('returns earnings for default 6 months in ONE query (L-208)', async () => {
      mockDb.booking.findMany.mockResolvedValue([] as never);

      const result = await getMonthlyEarnings('winery-123');

      expect(result).toHaveLength(6);
      expect(mockDb.booking.findMany).toHaveBeenCalledTimes(1);
    });

    it('returns earnings for custom number of months', async () => {
      mockDb.booking.findMany.mockResolvedValue([] as never);

      const result = await getMonthlyEarnings('winery-123', 3);

      expect(result).toHaveLength(3);
      expect(mockDb.booking.findMany).toHaveBeenCalledTimes(1);
    });

    it('buckets revenue and payout per month from the single window query', async () => {
      // System time: 2026-01-14 → window months are Dec 2025 + Jan 2026.
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          date: new Date('2026-01-05T00:00:00Z'),
          totalPrice: 10000,
          wineryPayout: 8800,
        },
        {
          date: new Date('2026-01-10T00:00:00Z'),
          totalPrice: 5000,
          wineryPayout: 4400,
        },
      ] as never);

      const result = await getMonthlyEarnings('winery-123', 2);

      expect(result[0].revenue).toBe(0);
      expect(result[0].payout).toBe(0);
      expect(result[0].bookingCount).toBe(0);
      expect(result[1].revenue).toBe(15000);
      expect(result[1].payout).toBe(13200);
      expect(result[1].bookingCount).toBe(2);
    });

    it('returns months in chronological order (oldest first)', async () => {
      mockDb.booking.findMany.mockResolvedValue([] as never);

      // System time: 2026-01-14
      const result = await getMonthlyEarnings('winery-123', 3);

      // Should be Nov 2025, Dec 2025, Jan 2026
      expect(result[0].month).toBe('2025-11');
      expect(result[1].month).toBe('2025-12');
      expect(result[2].month).toBe('2026-01');
    });

    it('includes month and monthLabel fields', async () => {
      mockDb.booking.findMany.mockResolvedValue([] as never);

      // System time: 2026-01-14
      const result = await getMonthlyEarnings('winery-123', 1);

      expect(result[0].month).toBe('2026-01');
      expect(result[0].monthLabel).toBe('Jan');
    });

    it('queries only confirmed/completed non-refunded bookings over the window', async () => {
      mockDb.booking.findMany.mockResolvedValue([] as never);

      await getMonthlyEarnings('winery-123', 1);

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wineryId: 'winery-123',
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
            refundIssued: false,
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
          select: {
            date: true,
            totalPrice: true,
            wineryPayout: true,
          },
        })
      );
    });

    it('returns zero values for months with no bookings', async () => {
      mockDb.booking.findMany.mockResolvedValue([] as never);

      const result = await getMonthlyEarnings('winery-123', 1);

      expect(result[0].revenue).toBe(0);
      expect(result[0].payout).toBe(0);
      expect(result[0].bookingCount).toBe(0);
    });
  });

  // ========================================
  // getTransactions
  // ========================================
  describe('getTransactions', () => {
    const mockBookingData = {
      id: 'b-1',
      reference: 'REF-001',
      date: new Date('2025-11-01T10:00:00Z'), // Long ago => paid
      guestCount: 4,
      totalPrice: 20000,
      serviceFeeCents: 0,
      platformFee: 2400,
      wineryPayout: 17600,
      status: BookingStatus.COMPLETED,
      refundIssued: false,
      refundAmount: null,
      visitorName: 'John',
      experience: { id: 'exp-1', title: 'Wine Tasting' },
    };

    it('queries bookings with correct status filter and ordering', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getTransactions('winery-123');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wineryId: 'winery-123',
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          }),
          orderBy: { date: 'desc' },
        })
      );
    });

    it('maps bookings to Transaction type', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([mockBookingData] as never);

      const result = await getTransactions('winery-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'b-1',
          bookingId: 'REF-001',
          experienceTitle: 'Wine Tasting',
          experienceId: 'exp-1',
          customer: { name: 'John', avatarUrl: undefined },
          guestCount: 4,
          grossAmount: 20000,
          platformFee: 2400,
          netPayout: 17600,
          reference: 'REF-001',
        })
      );
    });

    it('calculates completed status for past bookings', async () => {
      // Booking from Nov 2025, system time Jan 2026 => experience over
      mockDb.booking.findMany.mockResolvedValueOnce([mockBookingData] as never);

      const result = await getTransactions('winery-123');

      expect(result[0].status).toBe('completed');
    });

    it('calculates refunded status for refunded bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        { ...mockBookingData, refundIssued: true },
      ] as never);

      const result = await getTransactions('winery-123');

      expect(result[0].status).toBe('refunded');
    });

    it('calculates upcoming status for future bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          ...mockBookingData,
          date: new Date('2026-02-15T10:00:00Z'), // Future
          status: BookingStatus.CONFIRMED,
        },
      ] as never);

      const result = await getTransactions('winery-123');

      expect(result[0].status).toBe('upcoming');
    });

    it('refunded wins over upcoming/completed', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          ...mockBookingData,
          date: new Date('2026-02-15T10:00:00Z'), // Future AND refunded
          status: BookingStatus.CONFIRMED,
          refundIssued: true,
          refundAmount: 20000,
        },
      ] as never);

      const result = await getTransactions('winery-123');

      expect(result[0].status).toBe('refunded');
    });

    it('filters by month', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getTransactions('winery-123', { month: '2026-01' });

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: expect.any(Date), lte: expect.any(Date) },
          }),
        })
      );
    });

    it('filters by experienceId', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getTransactions('winery-123', { experienceId: 'exp-1' });

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            experienceId: 'exp-1',
          }),
        })
      );
    });

    it('filters by status after mapping (post-query filter)', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        mockBookingData, // paid
        {
          ...mockBookingData,
          id: 'b-2',
          reference: 'REF-002',
          refundIssued: true,
          refundAmount: 3600,
          visitorName: 'Jane',
        }, // refunded
      ] as never);

      const result = await getTransactions('winery-123', {
        status: 'refunded',
      });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('refunded');
      expect(result[0].customer.name).toBe('Jane');
    });

    it('applies multiple filters simultaneously', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getTransactions('winery-123', {
        month: '2026-01',
        experienceId: 'exp-456',
        status: 'completed',
      });

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wineryId: 'winery-123',
            experienceId: 'exp-456',
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('returns empty array when no transactions', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      const result = await getTransactions('winery-123');

      expect(result).toEqual([]);
    });

    it('returns empty array when status filter removes all results', async () => {
      // All paid bookings, but filter for refunded
      mockDb.booking.findMany.mockResolvedValueOnce([mockBookingData] as never);

      const result = await getTransactions('winery-123', {
        status: 'refunded',
      });

      expect(result).toEqual([]);
    });

    it('selects required fields including experience relation', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getTransactions('winery-123');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            reference: true,
            date: true,
            guestCount: true,
            totalPrice: true,
            platformFee: true,
            wineryPayout: true,
            status: true,
            refundIssued: true,
            visitorName: true,
            experience: {
              select: { id: true, title: true },
            },
          }),
        })
      );
    });
  });

  // ========================================
  // getYearToDateSummary
  // ========================================
  describe('getYearToDateSummary', () => {
    it('returns zero summary when no bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      const result = await getYearToDateSummary('winery-123');

      expect(result).toEqual({
        grossRevenue: 0,
        platformFees: 0,
        netEarnings: 0,
        totalBookings: 0,
        refundedAmount: 0,
      });
    });

    it('calculates summary from non-refunded bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          totalPrice: 20000,
          serviceFeeCents: 0,
          platformFee: 2400,
          wineryPayout: 17600,
          refundIssued: false,
          refundAmount: null,
          refundAmount: null,
        },
        {
          totalPrice: 10000,
          serviceFeeCents: 0,
          platformFee: 1200,
          wineryPayout: 8800,
          refundIssued: false,
          refundAmount: null,
          refundAmount: null,
        },
      ] as never);

      const result = await getYearToDateSummary('winery-123');

      expect(result.grossRevenue).toBe(30000);
      expect(result.platformFees).toBe(3600);
      expect(result.netEarnings).toBe(26400);
      expect(result.totalBookings).toBe(2);
    });

    it('calculates refunded amount from refunded bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          totalPrice: 20000,
          serviceFeeCents: 0,
          platformFee: 2400,
          wineryPayout: 17600,
          refundIssued: false,
          refundAmount: null,
          refundAmount: null,
        },
        {
          totalPrice: 15000,
          serviceFeeCents: 0,
          platformFee: 1800,
          wineryPayout: 13200,
          refundIssued: true,
          refundAmount: 3600,
          refundAmount: 15000,
        },
        {
          totalPrice: 5000,
          serviceFeeCents: 0,
          platformFee: 600,
          wineryPayout: 4400,
          refundIssued: true,
          refundAmount: 3600,
          refundAmount: 5000,
        },
      ] as never);

      const result = await getYearToDateSummary('winery-123');

      // Non-refunded stats
      expect(result.grossRevenue).toBe(20000);
      expect(result.platformFees).toBe(2400);
      expect(result.netEarnings).toBe(17600);
      expect(result.totalBookings).toBe(1);

      // Refunded stats
      expect(result.refundedAmount).toBe(20000);
    });

    it('handles null refundAmount gracefully', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          totalPrice: 5000,
          serviceFeeCents: 0,
          platformFee: 600,
          wineryPayout: 4400,
          refundIssued: true,
          refundAmount: null,
        },
      ] as never);

      const result = await getYearToDateSummary('winery-123');

      expect(result.refundedAmount).toBe(0);
    });

    it('queries bookings for current year', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getYearToDateSummary('winery-123');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith({
        where: {
          wineryId: 'winery-123',
          date: { gte: expect.any(Date), lte: expect.any(Date) },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
        select: {
          totalPrice: true,
          platformFee: true,
          wineryPayout: true,
          refundIssued: true,
          refundAmount: true,
        },
      });
    });
  });

  // ========================================
  // getMonthlyStatementData
  // ========================================
  describe('getMonthlyStatementData', () => {
    const statementBooking = {
      reference: 'ENC-AAAA0001',
      date: new Date('2025-12-10T10:00:00Z'),
      guestCount: 4,
      totalPrice: 10000,
      serviceFeeCents: 500,
      platformFee: 1200,
      wineryPayout: 8800,
      refundIssued: false,
      refundAmount: null,
      experience: { title: 'Dégustation' },
    };

    it('rejects an invalid month key without querying', async () => {
      const result = await getMonthlyStatementData('winery-123', '2025-13');
      expect(result).toBeNull();
      expect(mockDb.booking.findMany).not.toHaveBeenCalled();
    });

    it('includes NO_SHOW bookings and filters by a UTC month window', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getMonthlyStatementData('winery-123', '2025-12');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wineryId: 'winery-123',
            status: {
              in: [
                BookingStatus.CONFIRMED,
                BookingStatus.COMPLETED,
                BookingStatus.NO_SHOW,
              ],
            },
            // UTC bounds — Booking.date is a UTC-midnight @db.Date.
            date: {
              gte: new Date(Date.UTC(2025, 11, 1)),
              lt: new Date(Date.UTC(2026, 0, 1)),
            },
          }),
          orderBy: { date: 'asc' },
        })
      );
    });

    it('aggregates gross, commission, service fees and net', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        statementBooking,
        {
          ...statementBooking,
          reference: 'ENC-AAAA0002',
          totalPrice: 5000,
          serviceFeeCents: 250,
          platformFee: 600,
          wineryPayout: 4400,
        },
      ] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      expect(result?.grossCents).toBe(15000);
      expect(result?.commissionCents).toBe(1800);
      expect(result?.serviceFeesCents).toBe(750);
      expect(result?.noShowFeesCents).toBe(0);
      expect(result?.refundedCents).toBe(0);
      expect(result?.netCents).toBe(13200);
      expect(result?.lines).toHaveLength(2);
    });

    it('a full refund zeroes the line net; the summary reconciles exactly', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        statementBooking,
        {
          ...statementBooking,
          reference: 'ENC-AAAA0003',
          refundIssued: true,
          refundAmount: 10500, // totalPrice + serviceFee => full refund
        },
      ] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      // refundedCents = the NET impact (payout share), not the
      // client-facing refundAmount — so gross − commission − refunds = net.
      expect(result?.refundedCents).toBe(8800);
      expect(result?.netCents).toBe(8800); // only the non-refunded line
      expect(result?.lines[1]?.netCents).toBe(0);
      expect(result?.lines[1]?.refunded).toBe(true);
      expect(
        (result?.grossCents ?? 0) -
          (result?.commissionCents ?? 0) -
          (result?.refundedCents ?? 0)
      ).toBe(result?.netCents);
    });

    it('a partial refund keeps the proportional net and reconciles', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([
        {
          ...statementBooking,
          refundIssued: true,
          refundAmount: 5250, // half of paid (10500)
        },
      ] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      expect(result?.lines[0]?.netCents).toBe(4400); // 8800 × 0.5
      expect(result?.refundedCents).toBe(4400);
      expect(result?.netCents).toBe(4400);
      expect(
        (result?.grossCents ?? 0) -
          (result?.commissionCents ?? 0) -
          (result?.refundedCents ?? 0)
      ).toBe(result?.netCents);
    });
  });
});
