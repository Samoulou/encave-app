import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus } from '@prisma/client';

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    booking: { findMany: vi.fn() },
  },
}));

// Mock React cache (pass-through)
vi.mock('react', () => ({
  cache: (fn: Function) => fn,
}));

import { db } from '@/server/db';
import {
  getClientUpcomingBookings,
  getClientPastBookings,
} from '@/server/queries/client-booking.queries';

const mockDb = vi.mocked(db);

describe('Client Booking Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBooking = {
    id: 'booking-1',
    reference: 'REF-001',
    visitorName: 'John Doe',
    visitorEmail: 'john@test.com',
    visitorPhone: '+41 79 123 45 67',
    date: new Date('2025-06-15'),
    timeSlot: '14:00',
    guestCount: 4,
    totalPrice: 20000,
    status: BookingStatus.CONFIRMED,
    cancelledAt: null,
    refundIssued: false,
    refundAmount: null,
    createdAt: new Date('2025-05-01'),
    experience: {
      id: 'exp-1',
      title: 'Wine Tasting',
      slug: 'wine-tasting',
      coverPhoto: 'https://example.com/photo.jpg',
      duration: 90,
      type: 'TASTING',
    },
    winery: {
      name: 'Test Winery',
      slug: 'test-winery',
      address: 'Rue du Test 1',
      commune: 'Sion',
      phone: '+41 27 123 45 67',
      email: 'winery@test.com',
    },
  };

  // ========================================
  // getClientUpcomingBookings
  // ========================================
  describe('getClientUpcomingBookings', () => {
    it('queries bookings by email (case insensitive)', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([mockBooking] as never);

      const result = await getClientUpcomingBookings('john@test.com');

      expect(result).toHaveLength(1);
      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visitorEmail: { equals: 'john@test.com', mode: 'insensitive' },
            status: BookingStatus.CONFIRMED,
            date: { gte: expect.any(Date) },
          }),
          orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
        })
      );
    });

    it('returns empty array when no upcoming bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      const result = await getClientUpcomingBookings('john@test.com');

      expect(result).toHaveLength(0);
    });

    it('returns booking details with experience and winery', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([mockBooking] as never);

      const result = await getClientUpcomingBookings('john@test.com');

      expect(result[0].experience.title).toBe('Wine Tasting');
      expect(result[0].experience.slug).toBe('wine-tasting');
      expect(result[0].experience.duration).toBe(90);
      expect(result[0].winery.name).toBe('Test Winery');
      expect(result[0].winery.commune).toBe('Sion');
    });

    it('returns multiple bookings sorted by date ascending', async () => {
      const booking2 = {
        ...mockBooking,
        id: 'booking-2',
        reference: 'REF-002',
        date: new Date('2025-07-20'),
        timeSlot: '10:00',
      };
      mockDb.booking.findMany.mockResolvedValueOnce([
        mockBooking,
        booking2,
      ] as never);

      const result = await getClientUpcomingBookings('john@test.com');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('booking-1');
      expect(result[1].id).toBe('booking-2');
    });

    it('selects required fields including experience and winery relations', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getClientUpcomingBookings('john@test.com');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            reference: true,
            visitorName: true,
            visitorEmail: true,
            visitorPhone: true,
            date: true,
            timeSlot: true,
            guestCount: true,
            totalPrice: true,
            status: true,
            cancelledAt: true,
            refundIssued: true,
            refundAmount: true,
            createdAt: true,
            experience: {
              select: {
                id: true,
                title: true,
                slug: true,
                coverPhoto: true,
                duration: true,
                type: true,
              },
            },
            winery: {
              select: {
                name: true,
                slug: true,
                address: true,
                commune: true,
                phone: true,
                email: true,
              },
            },
          }),
        })
      );
    });
  });

  // ========================================
  // getClientPastBookings
  // ========================================
  describe('getClientPastBookings', () => {
    it('queries past bookings with correct filters', async () => {
      const pastBooking = {
        ...mockBooking,
        date: new Date('2025-01-15'),
        status: BookingStatus.COMPLETED,
      };
      mockDb.booking.findMany.mockResolvedValueOnce([pastBooking] as never);

      const result = await getClientPastBookings('john@test.com');

      expect(result).toHaveLength(1);
      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visitorEmail: { equals: 'john@test.com', mode: 'insensitive' },
            status: { not: BookingStatus.PENDING_PAYMENT },
            OR: expect.arrayContaining([
              { date: { lt: expect.any(Date) } },
              expect.objectContaining({
                status: expect.objectContaining({
                  in: expect.arrayContaining([
                    BookingStatus.COMPLETED,
                    BookingStatus.CANCELLED_BY_CLIENT,
                    BookingStatus.CANCELLED_BY_WINERY,
                    BookingStatus.NO_SHOW,
                  ]),
                }),
              }),
            ]),
          }),
          orderBy: [{ date: 'desc' }, { timeSlot: 'desc' }],
        })
      );
    });

    it('returns empty array when no past bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      const result = await getClientPastBookings('john@test.com');

      expect(result).toHaveLength(0);
    });

    it('includes cancelled bookings with refund details', async () => {
      const cancelledBooking = {
        ...mockBooking,
        status: BookingStatus.CANCELLED_BY_CLIENT,
        cancelledAt: new Date('2025-06-10'),
        refundIssued: true,
        refundAmount: 20000,
      };
      mockDb.booking.findMany.mockResolvedValueOnce([
        cancelledBooking,
      ] as never);

      const result = await getClientPastBookings('john@test.com');

      expect(result).toHaveLength(1);
      expect(result[0].refundIssued).toBe(true);
      expect(result[0].refundAmount).toBe(20000);
      expect(result[0].cancelledAt).toBeInstanceOf(Date);
    });

    it('orders past bookings by date descending (most recent first)', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getClientPastBookings('john@test.com');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ date: 'desc' }, { timeSlot: 'desc' }],
        })
      );
    });

    it('excludes PENDING_PAYMENT bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getClientPastBookings('john@test.com');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: BookingStatus.PENDING_PAYMENT },
          }),
        })
      );
    });

    it('uses same select clause as upcoming bookings', async () => {
      mockDb.booking.findMany.mockResolvedValueOnce([] as never);

      await getClientPastBookings('john@test.com');

      expect(mockDb.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            reference: true,
            visitorName: true,
            visitorEmail: true,
            date: true,
            status: true,
            experience: {
              select: expect.objectContaining({
                id: true,
                title: true,
                slug: true,
                coverPhoto: true,
                duration: true,
                type: true,
              }),
            },
            winery: {
              select: expect.objectContaining({
                name: true,
                slug: true,
                address: true,
                commune: true,
                phone: true,
                email: true,
              }),
            },
          }),
        })
      );
    });
  });
});
