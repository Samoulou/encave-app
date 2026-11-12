import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingStatus, NoShowChargeStatus } from '@prisma/client';

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    booking: { findMany: vi.fn(), groupBy: vi.fn() },
    winery: { findUnique: vi.fn() },
    experience: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/env', () => ({
  env: { PLATFORM_COMMISSION_RATE: 0.12 },
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

/**
 * A booking PAID ONLINE: 200.00 of tickets, 12 % commission → 176.00 net,
 * 10.00 client service fee (platform money).
 */
function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    reference: 'ENC-AAAA0001',
    date: new Date('2025-12-10T00:00:00.000Z'),
    guestCount: 4,
    status: BookingStatus.COMPLETED,
    totalPrice: 20000,
    serviceFeeCents: 1000,
    platformFee: 2400,
    wineryPayout: 17600,
    refundAmount: null,
    refundIssued: false,
    stripePaymentIntentId: 'pi_test_1',
    giftAppliedCents: 0,
    giftTransferId: null,
    visitorName: 'John',
    noShowFeeChargeStatus: null,
    noShowFeeChargedCents: null,
    noShowFeeRefundId: null,
    experience: { id: 'exp-1', title: 'Wine Tasting' },
    ...overrides,
  };
}

/** ON_SITE / free offer: price settled at the winery, no online money. */
const onSite = (overrides: Record<string, unknown> = {}) =>
  booking({
    reference: 'ENC-ONSITE01',
    stripePaymentIntentId: null,
    giftAppliedCents: 0,
    ...overrides,
  });

/** The candidates predicate every listing shares. */
const CANDIDATES_WHERE = {
  wineryId: 'winery-123',
  OR: [
    {
      status: {
        in: [
          BookingStatus.CONFIRMED,
          BookingStatus.COMPLETED,
          BookingStatus.NO_SHOW,
        ],
      },
    },
    {
      status: BookingStatus.CANCELLED_BY_CLIENT,
      OR: [
        { stripePaymentIntentId: { not: null } },
        { giftTransferId: { not: null } },
      ],
    },
  ],
};

describe('Earnings Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Wednesday, January 14, 2026 at 12:00 UTC
    vi.setSystemTime(new Date('2026-01-14T12:00:00Z'));
    mockDb.booking.findMany.mockResolvedValue([] as never);
    mockDb.booking.groupBy.mockResolvedValue([] as never);
    mockDb.winery.findUnique.mockResolvedValue({
      commissionRate: null,
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ========================================
  // getEarningsSummary
  // ========================================
  describe('getEarningsSummary', () => {
    it('returns a zero summary when the winery has no booking', async () => {
      const result = await getEarningsSummary('winery-123');

      expect(result).toEqual({
        totalEarnings: 0,
        thisMonth: 0,
        lastMonth: 0,
        yearToDate: 0,
        currentMonth: '2026-01',
        currentMonthLabel: 'janv.',
      });
    });

    it('localizes the month label through the formatters (no hard-coded English)', async () => {
      expect(
        (await getEarningsSummary('winery-123', 'fr')).currentMonthLabel
      ).toBe('janv.');
      expect(
        (await getEarningsSummary('winery-123', 'en')).currentMonthLabel
      ).toBe('Jan');
    });

    it('sums the un-refunded online majority IN THE DATABASE (group by date), never by loading every booking', async () => {
      await getEarningsSummary('winery-123');

      expect(mockDb.booking.groupBy).toHaveBeenCalledTimes(1);
      expect(mockDb.booking.groupBy).toHaveBeenCalledWith({
        by: ['date'],
        where: {
          wineryId: 'winery-123',
          // Only experiences already held count as earned.
          date: { lte: new Date('2026-01-14T12:00:00Z') },
          // NO_SHOW is money kept, exactly like COMPLETED.
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.COMPLETED,
              BookingStatus.NO_SHOW,
            ],
          },
          refundIssued: false,
          AND: [
            { OR: [{ refundAmount: null }, { refundAmount: { lte: 0 } }] },
            // ON_SITE rows never reach the money sums.
            {
              OR: [
                { stripePaymentIntentId: { not: null } },
                { giftAppliedCents: { gt: 0 } },
              ],
            },
          ],
        },
        _sum: { wineryPayout: true, totalPrice: true },
      });
      // The only rows loaded are the minority needing the per-booking rule.
      expect(mockDb.booking.findMany).toHaveBeenCalledTimes(1);
      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              CANDIDATES_WHERE,
              { date: { lte: new Date('2026-01-14T12:00:00Z') } },
              {
                OR: [
                  { refundIssued: true },
                  { refundAmount: { gt: 0 } },
                  { status: BookingStatus.CANCELLED_BY_CLIENT },
                ],
              },
            ],
          },
        })
      );
    });

    it('buckets the daily sums into all-time / this month / last month / year-to-date', async () => {
      mockDb.booking.groupBy.mockResolvedValue([
        {
          // 2024 — all-time only
          date: new Date('2024-06-01T00:00:00.000Z'),
          _sum: { wineryPayout: 1000, totalPrice: 1200 },
        },
        {
          // December 2025 — last month
          date: new Date('2025-12-10T00:00:00.000Z'),
          _sum: { wineryPayout: 17600, totalPrice: 20000 },
        },
        {
          // January 2026 — this month + year to date
          date: new Date('2026-01-05T00:00:00.000Z'),
          _sum: { wineryPayout: 8800, totalPrice: 10000 },
        },
      ] as never);

      const result = await getEarningsSummary('winery-123');

      expect(result.totalEarnings).toBe(1000 + 17600 + 8800);
      expect(result.lastMonth).toBe(17600);
      expect(result.thisMonth).toBe(8800);
      // Year to date is GROSS revenue (tickets).
      expect(result.yearToDate).toBe(10000);
    });

    it('deducts a PARTIAL ADMIN refund (refundIssued stays false) from net and gross', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({
          date: new Date('2026-01-05T00:00:00.000Z'),
          // 105.00 of the 210.00 paid went back: half.
          refundAmount: 10500,
          refundIssued: false,
        }),
      ] as never);

      const result = await getEarningsSummary('winery-123');

      expect(result.thisMonth).toBe(8800);
      expect(result.yearToDate).toBe(10000);
    });

    it('counts a LATE client cancellation where the winery kept the money', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({
          date: new Date('2026-01-05T00:00:00.000Z'),
          status: BookingStatus.CANCELLED_BY_CLIENT,
          refundAmount: null, // < 24 h: nothing refunded
        }),
      ] as never);

      const result = await getEarningsSummary('winery-123');

      expect(result.thisMonth).toBe(17600);
      expect(result.totalEarnings).toBe(17600);
    });

    it('never counts an ON_SITE booking as earnings, whatever is stored on the row', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        // Reaches the JS path only through a (bogus) refund flag.
        onSite({
          date: new Date('2026-01-05T00:00:00.000Z'),
          refundIssued: true,
          refundAmount: 0,
        }),
      ] as never);

      const result = await getEarningsSummary('winery-123');

      expect(result.totalEarnings).toBe(0);
      expect(result.yearToDate).toBe(0);
    });
  });

  // ========================================
  // getMonthlyEarnings
  // ========================================
  describe('getMonthlyEarnings', () => {
    it('reads the whole window in ONE query (L-208) over the shared candidates', async () => {
      const result = await getMonthlyEarnings('winery-123');

      expect(result).toHaveLength(6);
      expect(mockDb.booking.findMany).toHaveBeenCalledTimes(1);
      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              CANDIDATES_WHERE,
              { date: { gte: expect.any(Date), lte: expect.any(Date) } },
            ],
          },
        })
      );
    });

    it('returns the requested number of months, oldest first, with locale-neutral keys', async () => {
      const result = await getMonthlyEarnings('winery-123', 3);

      expect(result.map((m) => m.month)).toEqual([
        '2025-11',
        '2025-12',
        '2026-01',
      ]);
      expect(result.every((m) => m.revenue === 0 && m.payout === 0)).toBe(true);
    });

    it('localizes the month labels through the formatters', async () => {
      const fr = await getMonthlyEarnings('winery-123', 3, 'fr');
      const en = await getMonthlyEarnings('winery-123', 3, 'en');

      expect(fr.map((m) => m.monthLabel)).toEqual(['nov.', 'déc.', 'janv.']);
      expect(en.map((m) => m.monthLabel)).toEqual(['Nov', 'Dec', 'Jan']);
    });

    it('buckets money net of refunds and counts NO_SHOW like COMPLETED', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({ date: new Date('2025-12-10T00:00:00.000Z') }),
        booking({
          date: new Date('2025-12-12T00:00:00.000Z'),
          status: BookingStatus.NO_SHOW,
        }),
        booking({
          date: new Date('2026-01-05T00:00:00.000Z'),
          refundAmount: 10500, // half refunded
        }),
      ] as never);

      const result = await getMonthlyEarnings('winery-123', 2);

      expect(result[0]).toMatchObject({
        month: '2025-12',
        revenue: 40000,
        payout: 35200,
        bookingCount: 2,
      });
      expect(result[1]).toMatchObject({
        month: '2026-01',
        revenue: 10000,
        payout: 8800,
        bookingCount: 1,
      });
    });

    it('counts an ON_SITE booking as VOLUME only — no revenue, no payout', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({ date: new Date('2025-12-10T00:00:00.000Z') }),
        onSite({ date: new Date('2025-12-11T00:00:00.000Z') }),
      ] as never);

      const [december] = await getMonthlyEarnings('winery-123', 2);

      expect(december).toMatchObject({
        revenue: 20000,
        payout: 17600,
        bookingCount: 2,
      });
    });

    it('adds the money of a cancellation the winery kept, without counting it as a booking', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({
          date: new Date('2025-12-10T00:00:00.000Z'),
          status: BookingStatus.CANCELLED_BY_CLIENT,
          refundAmount: 10500, // STRICT 50 %
          refundIssued: true,
        }),
      ] as never);

      const [december] = await getMonthlyEarnings('winery-123', 2);

      expect(december).toMatchObject({
        revenue: 10000,
        payout: 8800,
        bookingCount: 0,
      });
    });
  });

  // ========================================
  // getTransactions
  // ========================================
  describe('getTransactions', () => {
    it('queries the shared candidates, newest first, bounded', async () => {
      await getTransactions('winery-123');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [CANDIDATES_WHERE] },
          orderBy: { date: 'desc' },
          take: 500,
        })
      );
    });

    it('maps a paid booking to a Transaction', async () => {
      mockDb.booking.findMany.mockResolvedValue([booking()] as never);

      const result = await getTransactions('winery-123');

      expect(result).toEqual([
        {
          id: 'b-1',
          date: new Date('2025-12-10T00:00:00.000Z'),
          bookingId: 'ENC-AAAA0001',
          experienceTitle: 'Wine Tasting',
          experienceId: 'exp-1',
          customer: { name: 'John', avatarUrl: undefined },
          guestCount: 4,
          grossAmount: 20000,
          platformFee: 2400,
          netPayout: 17600,
          status: 'completed',
          reference: 'ENC-AAAA0001',
        },
      ]);
    });

    it('shows amounts NET of a refund and flags the row refunded — refundIssued or not', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({ refundAmount: 10500, refundIssued: false }),
      ] as never);

      const [row] = await getTransactions('winery-123');

      expect(row).toMatchObject({
        grossAmount: 20000,
        platformFee: 1200,
        netPayout: 8800,
        status: 'refunded',
      });
    });

    it('lists a NO_SHOW (money kept) and marks a future booking upcoming', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({ id: 'b-ns', status: BookingStatus.NO_SHOW }),
        booking({
          id: 'b-future',
          status: BookingStatus.CONFIRMED,
          date: new Date('2026-02-01T00:00:00.000Z'),
        }),
      ] as never);

      const result = await getTransactions('winery-123');

      expect(result.map((t) => [t.id, t.status])).toEqual([
        ['b-ns', 'completed'],
        ['b-future', 'upcoming'],
      ]);
    });

    it('is a MONEY ledger: an ON_SITE booking is not a transaction', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking(),
        onSite({ id: 'b-onsite' }),
      ] as never);

      const result = await getTransactions('winery-123');

      expect(result.map((t) => t.id)).toEqual(['b-1']);
    });

    it('lists a cancellation the winery kept, never one that was fully refunded', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({
          id: 'b-late',
          status: BookingStatus.CANCELLED_BY_CLIENT,
          date: new Date('2026-02-01T00:00:00.000Z'),
        }),
        booking({
          id: 'b-full',
          status: BookingStatus.CANCELLED_BY_CLIENT,
          refundAmount: 21000,
          refundIssued: true,
        }),
      ] as never);

      const result = await getTransactions('winery-123');

      // Kept in full → "completed" (never "upcoming": it will not happen).
      expect(result.map((t) => [t.id, t.status, t.netPayout])).toEqual([
        ['b-late', 'completed', 17600],
      ]);
    });

    it('filters by month and experience in the query, by status after mapping', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({ id: 'b-ok' }),
        booking({ id: 'b-ref', refundAmount: 10500 }),
      ] as never);

      const result = await getTransactions('winery-123', {
        month: '2025-12',
        experienceId: 'exp-1',
        status: 'refunded',
      });

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              CANDIDATES_WHERE,
              { date: { gte: expect.any(Date), lte: expect.any(Date) } },
              { experienceId: 'exp-1' },
            ],
          },
        })
      );
      expect(result.map((t) => t.id)).toEqual(['b-ref']);
    });

    it('returns an empty array when there is nothing', async () => {
      expect(await getTransactions('winery-123')).toEqual([]);
    });
  });

  // ========================================
  // getYearToDateSummary
  // ========================================
  describe('getYearToDateSummary', () => {
    it('returns a zero summary when no bookings', async () => {
      expect(await getYearToDateSummary('winery-123')).toEqual({
        grossRevenue: 0,
        platformFees: 0,
        netEarnings: 0,
        totalBookings: 0,
        refundedAmount: 0,
      });
    });

    it('queries the current year over the shared candidates', async () => {
      await getYearToDateSummary('winery-123');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              CANDIDATES_WHERE,
              { date: { gte: expect.any(Date), lte: expect.any(Date) } },
            ],
          },
        })
      );
    });

    it('reconciles: gross − fees − refunds = net, ON_SITE counted as a booking only', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking(),
        booking({ refundAmount: 10500 }), // half refunded
        onSite(),
      ] as never);

      const result = await getYearToDateSummary('winery-123');

      expect(result).toEqual({
        grossRevenue: 40000,
        platformFees: 2400 + 1200,
        netEarnings: 17600 + 8800,
        totalBookings: 3,
        refundedAmount: 10000,
      });
      expect(
        result.grossRevenue - result.platformFees - result.refundedAmount
      ).toBe(result.netEarnings);
    });
  });

  // ========================================
  // getMonthlyStatementData
  // ========================================
  describe('getMonthlyStatementData', () => {
    it('rejects an invalid month key without querying', async () => {
      const result = await getMonthlyStatementData('winery-123', '2025-13');
      expect(result).toBeNull();
      expect(mockDb.booking.findMany).not.toHaveBeenCalled();
    });

    it('filters the shared candidates by a UTC month window', async () => {
      await getMonthlyStatementData('winery-123', '2025-12');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              CANDIDATES_WHERE,
              {
                // UTC bounds — Booking.date is a UTC-midnight @db.Date.
                date: {
                  gte: new Date(Date.UTC(2025, 11, 1)),
                  lt: new Date(Date.UTC(2026, 0, 1)),
                },
              },
            ],
          },
          orderBy: { date: 'asc' },
        })
      );
    });

    it('aggregates gross, commission, service fees and net', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking(),
        booking({
          reference: 'ENC-AAAA0002',
          totalPrice: 10000,
          serviceFeeCents: 500,
          platformFee: 1200,
          wineryPayout: 8800,
          status: BookingStatus.NO_SHOW,
        }),
      ] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      expect(result).toMatchObject({
        month: '2025-12',
        grossCents: 30000,
        commissionCents: 3600,
        serviceFeesCents: 1500,
        noShowFeesCents: 0,
        refundedCents: 0,
        netCents: 26400,
      });
      expect(result?.lines).toHaveLength(2);
    });

    it('WRONG CASE 1 — an ON_SITE booking is listed as volume, with no commission and no "net reversé"', async () => {
      mockDb.booking.findMany.mockResolvedValue([booking(), onSite()] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      // Totals are the online booking alone.
      expect(result).toMatchObject({
        grossCents: 20000,
        commissionCents: 2400,
        serviceFeesCents: 1000,
        netCents: 17600,
      });
      expect(result?.lines.map((l) => [l.reference, l.onSite])).toEqual([
        ['ENC-AAAA0001', false],
        ['ENC-ONSITE01', true],
      ]);
      expect(result?.lines[1]).toMatchObject({
        grossCents: 0,
        commissionCents: 0,
        netCents: 0,
      });
    });

    it('WRONG CASE 2 — a cancelled booking where the winery keeps money appears net of the refund', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        // Late cancellation: 0 % refunded, the winery keeps everything.
        booking({
          reference: 'ENC-LATE0001',
          status: BookingStatus.CANCELLED_BY_CLIENT,
        }),
        // STRICT middle tier: 50 % refunded.
        booking({
          reference: 'ENC-HALF0001',
          status: BookingStatus.CANCELLED_BY_CLIENT,
          refundAmount: 10500,
          refundIssued: true,
        }),
        // Fully refunded: earned nothing, not on the statement.
        booking({
          reference: 'ENC-FULL0001',
          status: BookingStatus.CANCELLED_BY_CLIENT,
          refundAmount: 21000,
          refundIssued: true,
        }),
      ] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      expect(
        result?.lines.map((l) => [l.reference, l.netCents, l.cancelled])
      ).toEqual([
        ['ENC-LATE0001', 17600, true],
        ['ENC-HALF0001', 8800, true],
      ]);
      expect(result).toMatchObject({
        grossCents: 40000,
        commissionCents: 2400 + 1200,
        refundedCents: 10000,
        // Service fee kept: 10.00 in full + half of 10.00.
        serviceFeesCents: 1500,
        netCents: 26400,
      });
    });

    it('WRONG CASE 3 — a partial ADMIN refund (refundIssued false) is deducted', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({ refundAmount: 10500, refundIssued: false }),
      ] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      expect(result).toMatchObject({
        grossCents: 20000,
        commissionCents: 1200,
        refundedCents: 10000,
        netCents: 8800,
      });
      expect(result?.lines[0]).toMatchObject({
        refunded: true,
        netCents: 8800,
      });
    });

    it('a full refund zeroes the line net; the summary reconciles exactly', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking(),
        booking({
          reference: 'ENC-AAAA0002',
          refundIssued: true,
          refundAmount: 21000,
        }),
      ] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      expect(result?.lines[1]).toMatchObject({ netCents: 0, refunded: true });
      expect(
        (result?.grossCents ?? 0) -
          (result?.commissionCents ?? 0) -
          (result?.refundedCents ?? 0)
      ).toBe(result?.netCents);
    });

    it('an odd partial refund still reconciles to the cent', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        booking({
          totalPrice: 9990,
          serviceFeeCents: 250,
          platformFee: 999,
          wineryPayout: 8991,
          refundAmount: 3333,
        }),
      ] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      expect(
        (result?.grossCents ?? 0) -
          (result?.commissionCents ?? 0) -
          (result?.refundedCents ?? 0)
      ).toBe(result?.netCents);
    });

    it('keeps no-show fees on their own line (net of the tier commission), added to the net', async () => {
      mockDb.booking.findMany.mockResolvedValue([
        // ON_SITE no-show whose fee was charged: 30.00 − 12 % = 26.40 kept.
        onSite({
          status: BookingStatus.NO_SHOW,
          noShowFeeChargeStatus: NoShowChargeStatus.CHARGED,
          noShowFeeChargedCents: 3000,
        }),
        // Charged then reverted (refunded): nets to 0.
        onSite({
          reference: 'ENC-ONSITE02',
          status: BookingStatus.NO_SHOW,
          noShowFeeChargeStatus: NoShowChargeStatus.CHARGED,
          noShowFeeChargedCents: 3000,
          noShowFeeRefundId: 're_1',
        }),
      ] as never);

      const result = await getMonthlyStatementData('winery-123', '2025-12');

      expect(result).toMatchObject({
        grossCents: 0,
        commissionCents: 0,
        noShowFeesCents: 2640,
        netCents: 2640,
      });
    });
  });
});
