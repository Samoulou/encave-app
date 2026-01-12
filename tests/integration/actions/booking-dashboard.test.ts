import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingStatus } from '@prisma/client';

// Mock auth
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
    },
    booking: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';

describe('Booking Dashboard Server Actions', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'winemaker@example.com' },
  };

  const mockWinery = {
    id: 'winery-123',
    slug: 'test-winery',
  };

  const mockBooking = {
    id: 'booking-123',
    reference: 'ENC-TEST001',
    status: BookingStatus.CONFIRMED,
    visitorName: 'Test Visitor',
    visitorEmail: 'visitor@example.com',
    visitorPhone: '+41791234567',
    date: new Date('2026-01-10'),
    timeSlot: '14:00',
    guestCount: 4,
    totalPrice: 20000,
    wineryPayout: 17000,
    wineryId: 'winery-123',
    experience: {
      id: 'exp-123',
      title: 'Wine Tasting Experience',
      slug: 'wine-tasting',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-12T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('markBookingCompleted', () => {
    it('marks a past confirmed booking as completed', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findFirst).mockResolvedValue(mockBooking as never);
      vi.mocked(db.booking.update).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.COMPLETED,
      } as never);

      const { markBookingCompleted } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingCompleted('booking-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(BookingStatus.COMPLETED);
      }
      expect(db.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-123' },
        data: { status: BookingStatus.COMPLETED },
      });
    });

    it('returns UNAUTHORIZED when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const { markBookingCompleted } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingCompleted('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN when user is not a winery owner', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(null);

      const { markBookingCompleted } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingCompleted('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns NOT_FOUND when booking does not exist', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const { markBookingCompleted } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingCompleted('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns VALIDATION_ERROR for non-confirmed booking', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findFirst).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED_BY_CLIENT,
      } as never);

      const { markBookingCompleted } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingCompleted('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('confirmed');
      }
    });

    it('returns VALIDATION_ERROR for future booking', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findFirst).mockResolvedValue({
        ...mockBooking,
        date: new Date('2026-01-15'), // Future date
        timeSlot: '14:00',
      } as never);

      const { markBookingCompleted } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingCompleted('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('future');
      }
    });

    it('verifies booking belongs to the winery', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const { markBookingCompleted } = await import(
        '@/server/actions/booking-dashboard'
      );
      await markBookingCompleted('booking-123');

      expect(db.booking.findFirst).toHaveBeenCalledWith({
        where: { id: 'booking-123', wineryId: 'winery-123' },
      });
    });
  });

  describe('markBookingNoShow', () => {
    it('marks a past confirmed booking as no-show', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findFirst).mockResolvedValue(mockBooking as never);
      vi.mocked(db.booking.update).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.NO_SHOW,
      } as never);

      const { markBookingNoShow } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingNoShow('booking-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(BookingStatus.NO_SHOW);
      }
      expect(db.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-123' },
        data: { status: BookingStatus.NO_SHOW },
      });
    });

    it('returns UNAUTHORIZED when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const { markBookingNoShow } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingNoShow('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN when user is not a winery owner', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(null);

      const { markBookingNoShow } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingNoShow('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns VALIDATION_ERROR for non-confirmed booking', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findFirst).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.COMPLETED,
      } as never);

      const { markBookingNoShow } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingNoShow('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns VALIDATION_ERROR for future booking', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findFirst).mockResolvedValue({
        ...mockBooking,
        date: new Date('2026-01-15'),
        timeSlot: '14:00',
      } as never);

      const { markBookingNoShow } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await markBookingNoShow('booking-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('exportBookingsToCSV', () => {
    const mockBookings = [
      {
        ...mockBooking,
        createdAt: new Date('2026-01-05'),
        cancelledAt: null,
        refundIssued: false,
        refundAmount: null,
      },
      {
        ...mockBooking,
        id: 'booking-456',
        reference: 'ENC-TEST002',
        visitorName: 'Jane Doe',
        visitorEmail: 'jane@example.com',
        totalPrice: 15000,
        wineryPayout: 12750,
        status: BookingStatus.COMPLETED,
      },
    ];

    it('exports bookings to CSV format', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findMany).mockResolvedValue(mockBookings as never);

      const { exportBookingsToCSV } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await exportBookingsToCSV();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.csvData).toContain('Date,Time,Experience');
        expect(result.data.csvData).toContain('Test Visitor');
        expect(result.data.csvData).toContain('Jane Doe');
        expect(result.data.filename).toMatch(/^bookings_test-winery_\d{4}-\d{2}-\d{2}\.csv$/);
      }
    });

    it('includes correct CSV headers', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findMany).mockResolvedValue(mockBookings as never);

      const { exportBookingsToCSV } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await exportBookingsToCSV();

      expect(result.success).toBe(true);
      if (result.success) {
        const headers = result.data.csvData.split('\n')[0];
        expect(headers).toContain('Date');
        expect(headers).toContain('Time');
        expect(headers).toContain('Experience');
        expect(headers).toContain('Client Name');
        expect(headers).toContain('Email');
        expect(headers).toContain('Phone');
        expect(headers).toContain('Guests');
        expect(headers).toContain('Status');
        expect(headers).toContain('Amount');
        expect(headers).toContain('Payout');
        expect(headers).toContain('Reference');
      }
    });

    it('formats currency amounts correctly (cents to CHF)', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findMany).mockResolvedValue(mockBookings as never);

      const { exportBookingsToCSV } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await exportBookingsToCSV();

      expect(result.success).toBe(true);
      if (result.success) {
        // 20000 cents = 200.00 CHF
        expect(result.data.csvData).toContain('200.00');
        // 15000 cents = 150.00 CHF
        expect(result.data.csvData).toContain('150.00');
      }
    });

    it('escapes CSV fields with commas', async () => {
      const bookingWithComma = {
        ...mockBooking,
        visitorName: 'Doe, John',
        experience: { ...mockBooking.experience, title: 'Wine, Cheese & More' },
      };
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findMany).mockResolvedValue([bookingWithComma] as never);

      const { exportBookingsToCSV } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await exportBookingsToCSV();

      expect(result.success).toBe(true);
      if (result.success) {
        // Fields with commas should be quoted
        expect(result.data.csvData).toContain('"Doe, John"');
        expect(result.data.csvData).toContain('"Wine, Cheese & More"');
      }
    });

    it('applies filters when provided', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      const { exportBookingsToCSV } = await import(
        '@/server/actions/booking-dashboard'
      );
      await exportBookingsToCSV({
        status: [BookingStatus.CONFIRMED],
        search: 'Test',
      });

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wineryId: 'winery-123',
            status: { in: [BookingStatus.CONFIRMED] },
          }),
        })
      );
    });

    it('returns UNAUTHORIZED when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const { exportBookingsToCSV } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await exportBookingsToCSV();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN when user is not a winery owner', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(null);

      const { exportBookingsToCSV } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await exportBookingsToCSV();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('getClientHistory', () => {
    const mockClientBookings = [
      {
        id: 'booking-1',
        reference: 'ENC-001',
        date: new Date('2026-01-05'),
        timeSlot: '14:00',
        guestCount: 2,
        totalPrice: 10000,
        status: BookingStatus.COMPLETED,
        experience: { title: 'Wine Tasting' },
      },
      {
        id: 'booking-2',
        reference: 'ENC-002',
        date: new Date('2025-12-15'),
        timeSlot: '11:00',
        guestCount: 4,
        totalPrice: 20000,
        status: BookingStatus.COMPLETED,
        experience: { title: 'Cellar Tour' },
      },
    ];

    it('returns booking history for a client', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findMany).mockResolvedValue(mockClientBookings as never);

      const { getClientHistory } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await getClientHistory('visitor@example.com');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bookings).toHaveLength(2);
        expect(result.data.bookings[0]?.reference).toBe('ENC-001');
        expect(result.data.bookings[1]?.reference).toBe('ENC-002');
      }
    });

    it('queries with case-insensitive email matching', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      const { getClientHistory } = await import(
        '@/server/actions/booking-dashboard'
      );
      await getClientHistory('Visitor@EXAMPLE.com');

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visitorEmail: { equals: 'Visitor@EXAMPLE.com', mode: 'insensitive' },
          }),
        })
      );
    });

    it('orders bookings by date descending', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      const { getClientHistory } = await import(
        '@/server/actions/booking-dashboard'
      );
      await getClientHistory('visitor@example.com');

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'desc' },
        })
      );
    });

    it('returns UNAUTHORIZED when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const { getClientHistory } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await getClientHistory('visitor@example.com');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN when user is not a winery owner', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(null);

      const { getClientHistory } = await import(
        '@/server/actions/booking-dashboard'
      );
      const result = await getClientHistory('visitor@example.com');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('only returns bookings for the current winery', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.booking.findMany).mockResolvedValue([]);

      const { getClientHistory } = await import(
        '@/server/actions/booking-dashboard'
      );
      await getClientHistory('visitor@example.com');

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            wineryId: 'winery-123',
          }),
        })
      );
    });
  });
});
