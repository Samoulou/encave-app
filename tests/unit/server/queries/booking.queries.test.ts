import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingStatus } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
    },
    experience: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from '@/server/db';
import {
  getWineryBookings,
  getBookingSummary,
  getWineryExperiencesForFilter,
  getClientHistoryWithWinery,
  getBookingForWinery,
} from '@/server/queries/booking.queries';

describe('booking.queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-12T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getWineryBookings', () => {
    const mockBookings = [
      {
        id: 'booking-1',
        reference: 'ENC-001',
        visitorEmail: 'test@example.com',
        visitorName: 'Test User',
        visitorPhone: '+41791234567',
        date: new Date('2026-01-15'),
        timeSlot: '14:00',
        guestCount: 2,
        totalPrice: 10000,
        wineryPayout: 8500,
        status: BookingStatus.CONFIRMED,
        cancelledAt: null,
        refundIssued: false,
        refundAmount: null,
        createdAt: new Date('2026-01-10'),
        experience: {
          id: 'exp-1',
          title: 'Wine Tasting',
          slug: 'wine-tasting',
        },
      },
    ];

    it('returns bookings for a winery', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue(mockBookings as never);

      const result = await getWineryBookings('winery-123');

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { wineryId: 'winery-123' },
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.reference).toBe('ENC-001');
    });

    it('applies status filter correctly', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getWineryBookings('winery-123', {
        status: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
      });

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          }),
        })
      );
    });

    it('applies experience filter correctly', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getWineryBookings('winery-123', { experienceId: 'exp-123' });

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            experienceId: 'exp-123',
          }),
        })
      );
    });

    it('applies date range filter correctly', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-01-31');

      await getWineryBookings('winery-123', { dateFrom, dateTo });

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: dateFrom, lte: dateTo },
          }),
        })
      );
    });

    it('applies search filter for client name', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getWineryBookings('winery-123', { search: 'John' });

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { visitorName: { contains: 'John', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('applies search filter for booking reference', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getWineryBookings('winery-123', { search: 'enc-001' });

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { reference: { contains: 'ENC-001', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('sorts by date ascending by default', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getWineryBookings('winery-123');

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
        })
      );
    });

    it('sorts by specified field and direction', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getWineryBookings('winery-123', undefined, {
        field: 'totalPrice',
        direction: 'desc',
      });

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ totalPrice: 'desc' }, { timeSlot: 'asc' }],
        })
      );
    });

    it('sorts by guest count when specified', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getWineryBookings('winery-123', undefined, {
        field: 'guestCount',
        direction: 'asc',
      });

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ guestCount: 'asc' }, { timeSlot: 'asc' }],
        })
      );
    });

    it('selects required fields including experience relation', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getWineryBookings('winery-123');

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            reference: true,
            visitorEmail: true,
            visitorName: true,
            experience: {
              select: { id: true, title: true, slug: true },
            },
          }),
        })
      );
    });
  });

  describe('getBookingSummary', () => {
    it('returns summary statistics for a winery', async () => {
      vi.mocked(db.booking.aggregate)
        .mockResolvedValueOnce({ _count: 3, _sum: { guestCount: 8 } } as never) // Today
        .mockResolvedValueOnce({
          _count: 10,
          _sum: { guestCount: 25 },
        } as never) // Week
        .mockResolvedValueOnce({
          _count: 45,
          _sum: { guestCount: 120 },
        } as never) // Month
        .mockResolvedValueOnce({ _sum: { guestCount: 500 } } as never); // Total

      const result = await getBookingSummary('winery-123');

      expect(result).toEqual({
        todayCount: 3,
        todayGuests: 8,
        weekCount: 10,
        weekGuests: 25,
        monthCount: 45,
        monthGuests: 120,
        totalGuests: 500,
      });
    });

    it('handles null guest counts gracefully', async () => {
      vi.mocked(db.booking.aggregate)
        .mockResolvedValueOnce({
          _count: 0,
          _sum: { guestCount: null },
        } as never)
        .mockResolvedValueOnce({
          _count: 0,
          _sum: { guestCount: null },
        } as never)
        .mockResolvedValueOnce({
          _count: 0,
          _sum: { guestCount: null },
        } as never)
        .mockResolvedValueOnce({ _sum: { guestCount: null } } as never);

      const result = await getBookingSummary('winery-123');

      expect(result).toEqual({
        todayCount: 0,
        todayGuests: 0,
        weekCount: 0,
        weekGuests: 0,
        monthCount: 0,
        monthGuests: 0,
        totalGuests: 0,
      });
    });

    it('only counts CONFIRMED and COMPLETED bookings', async () => {
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _count: 0,
        _sum: { guestCount: null },
      } as never);

      await getBookingSummary('winery-123');

      const calls = vi.mocked(db.booking.aggregate).mock.calls;
      calls.forEach((call) => {
        const whereClause = call[0]?.where;
        expect(whereClause?.status).toEqual({
          in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
        });
      });
    });

    it('calculates date ranges correctly', async () => {
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _count: 0,
        _sum: { guestCount: null },
      } as never);

      await getBookingSummary('winery-123');

      const todayCall = vi.mocked(db.booking.aggregate).mock.calls[0];
      const weekCall = vi.mocked(db.booking.aggregate).mock.calls[1];
      const monthCall = vi.mocked(db.booking.aggregate).mock.calls[2];

      // Today should have date range for Jan 12 (uses gte/lt pattern)
      expect(todayCall?.[0]?.where?.date?.gte).toBeDefined();
      expect(todayCall?.[0]?.where?.date?.lt).toBeDefined();

      // Upcoming window starts today and includes the next 7 calendar days.
      expect(weekCall?.[0]?.where?.date?.gte).toBeDefined();
      expect(weekCall?.[0]?.where?.date?.lt).toBeDefined();

      // Month should start on Jan 1
      expect(monthCall?.[0]?.where?.date?.gte).toBeDefined();
    });

    it('fetches all statistics in parallel', async () => {
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _count: 0,
        _sum: { guestCount: null },
      } as never);

      await getBookingSummary('winery-123');

      // Should make 4 aggregate calls
      expect(db.booking.aggregate).toHaveBeenCalledTimes(4);
    });
  });

  describe('getWineryExperiencesForFilter', () => {
    it('returns experiences for dropdown filter', async () => {
      const mockExperiences = [
        { id: 'exp-1', title: 'Cellar Tour' },
        { id: 'exp-2', title: 'Wine Tasting' },
      ];
      vi.mocked(db.experience.findMany).mockResolvedValue(
        mockExperiences as never
      );

      const result = await getWineryExperiencesForFilter('winery-123');

      expect(result).toHaveLength(2);
      expect(result[0]?.title).toBe('Cellar Tour');
    });

    it('filters by winery ID', async () => {
      vi.mocked(db.experience.findMany).mockResolvedValue([]);

      await getWineryExperiencesForFilter('winery-123');

      expect(db.experience.findMany).toHaveBeenCalledWith({
        where: { wineryId: 'winery-123' },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      });
    });

    it('orders experiences alphabetically by title', async () => {
      vi.mocked(db.experience.findMany).mockResolvedValue([]);

      await getWineryExperiencesForFilter('winery-123');

      expect(db.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'asc' },
        })
      );
    });

    it('returns empty array when no experiences exist', async () => {
      vi.mocked(db.experience.findMany).mockResolvedValue([]);

      const result = await getWineryExperiencesForFilter('winery-123');

      expect(result).toEqual([]);
    });
  });

  describe('getClientHistoryWithWinery', () => {
    const mockClientBookings = [
      {
        id: 'booking-1',
        reference: 'ENC-001',
        visitorEmail: 'client@example.com',
        visitorName: 'Client Name',
        visitorPhone: '+41791234567',
        date: new Date('2026-01-10'),
        timeSlot: '14:00',
        guestCount: 2,
        totalPrice: 10000,
        wineryPayout: 8500,
        status: BookingStatus.COMPLETED,
        cancelledAt: null,
        refundIssued: false,
        refundAmount: null,
        createdAt: new Date('2026-01-05'),
        experience: {
          id: 'exp-1',
          title: 'Wine Tasting',
          slug: 'wine-tasting',
        },
      },
    ];

    it('returns booking history for a client', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue(
        mockClientBookings as never
      );

      const result = await getClientHistoryWithWinery(
        'winery-123',
        'client@example.com'
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.visitorEmail).toBe('client@example.com');
    });

    it('filters by winery ID and email', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getClientHistoryWithWinery('winery-123', 'client@example.com');

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            wineryId: 'winery-123',
            visitorEmail: { equals: 'client@example.com', mode: 'insensitive' },
          },
        })
      );
    });

    it('uses case-insensitive email matching', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getClientHistoryWithWinery('winery-123', 'CLIENT@EXAMPLE.COM');

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visitorEmail: { equals: 'CLIENT@EXAMPLE.COM', mode: 'insensitive' },
          }),
        })
      );
    });

    it('orders by date descending (most recent first)', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      await getClientHistoryWithWinery('winery-123', 'client@example.com');

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'desc' },
        })
      );
    });

    it('returns empty array when no bookings found', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      const result = await getClientHistoryWithWinery(
        'winery-123',
        'nohistory@example.com'
      );

      expect(result).toEqual([]);
    });
  });

  describe('getBookingForWinery', () => {
    const mockBooking = {
      id: 'booking-123',
      reference: 'ENC-001',
      visitorEmail: 'test@example.com',
      visitorName: 'Test User',
      visitorPhone: '+41791234567',
      date: new Date('2026-01-15'),
      timeSlot: '14:00',
      guestCount: 2,
      totalPrice: 10000,
      wineryPayout: 8500,
      status: BookingStatus.CONFIRMED,
      cancelledAt: null,
      refundIssued: false,
      refundAmount: null,
      createdAt: new Date('2026-01-10'),
      experience: { id: 'exp-1', title: 'Wine Tasting', slug: 'wine-tasting' },
    };

    it('returns a single booking by ID for a winery', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(mockBooking as never);

      const result = await getBookingForWinery('booking-123', 'winery-123');

      expect(result).toEqual(mockBooking);
    });

    it('filters by both booking ID and winery ID', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      await getBookingForWinery('booking-123', 'winery-123');

      expect(db.booking.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'booking-123',
          wineryId: 'winery-123',
        },
        select: expect.any(Object),
      });
    });

    it('returns null when booking not found', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const result = await getBookingForWinery('non-existent', 'winery-123');

      expect(result).toBeNull();
    });

    it('returns null when booking belongs to different winery', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const result = await getBookingForWinery('booking-123', 'other-winery');

      expect(result).toBeNull();
      expect(db.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'booking-123',
            wineryId: 'other-winery',
          },
        })
      );
    });

    it('selects required fields including experience relation', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      await getBookingForWinery('booking-123', 'winery-123');

      expect(db.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            reference: true,
            visitorEmail: true,
            visitorName: true,
            status: true,
            experience: {
              select: { id: true, title: true, slug: true },
            },
          }),
        })
      );
    });
  });
});
