import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('@/server/db', () => ({
  db: {
    experience: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    booking: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { db } from '@/server/db';
import { BookingStatus } from '@prisma/client';

// Import actions after mocks
const { checkAvailability, getTimeSlotsForDate, getExperienceForBooking } =
  await import('@/server/actions/booking');

describe('Booking Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAvailability', () => {
    it('returns NOT_FOUND when experience does not exist', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(null);

      const result = await checkAvailability({
        experienceId: 'exp-123',
        date: '2024-06-15',
        timeSlot: '10:00',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns VALIDATION_ERROR for malformed input', async () => {
      // @ts-expect-error - testing invalid input
      const result = await checkAvailability({
        experienceId: 123, // should be string
        date: '2024-06-15',
        timeSlot: '10:00',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns full capacity when no bookings exist', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        maxCapacity: 10,
      } as never);
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: null },
      } as never);

      const result = await checkAvailability({
        experienceId: 'exp-123',
        date: '2024-06-15',
        timeSlot: '10:00',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.available).toBe(true);
        expect(result.data.remainingCapacity).toBe(10);
        expect(result.data.maxCapacity).toBe(10);
        expect(result.data.bookedCount).toBe(0);
      }
    });

    it('calculates remaining capacity correctly with existing bookings', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        maxCapacity: 10,
      } as never);
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 6 },
      } as never);

      const result = await checkAvailability({
        experienceId: 'exp-123',
        date: '2024-06-15',
        timeSlot: '10:00',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.available).toBe(true);
        expect(result.data.remainingCapacity).toBe(4);
        expect(result.data.bookedCount).toBe(6);
      }
    });

    it('returns unavailable when fully booked', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        maxCapacity: 10,
      } as never);
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 10 },
      } as never);

      const result = await checkAvailability({
        experienceId: 'exp-123',
        date: '2024-06-15',
        timeSlot: '10:00',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.available).toBe(false);
        expect(result.data.remainingCapacity).toBe(0);
      }
    });

    it('only counts PENDING_PAYMENT and CONFIRMED bookings', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        maxCapacity: 10,
      } as never);
      vi.mocked(db.booking.aggregate).mockResolvedValue({
        _sum: { guestCount: 5 },
      } as never);

      await checkAvailability({
        experienceId: 'exp-123',
        date: '2024-06-15',
        timeSlot: '10:00',
      });

      expect(db.booking.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
            },
          }),
        })
      );
    });
  });

  describe('getTimeSlotsForDate', () => {
    it('returns NOT_FOUND when experience does not exist', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue(null);

      const result = await getTimeSlotsForDate('exp-123', '2024-06-15');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns empty array when no slots for that day', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        id: 'exp-123',
        maxCapacity: 10,
        availabilitySlots: [],
      } as never);
      vi.mocked(db.booking.groupBy).mockResolvedValue([]);

      const result = await getTimeSlotsForDate('exp-123', '2024-06-15');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns slots with remaining capacity', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        id: 'exp-123',
        maxCapacity: 10,
        availabilitySlots: [
          { startTime: '10:00', dayOfWeek: 6 },
          { startTime: '14:00', dayOfWeek: 6 },
        ],
      } as never);
      vi.mocked(db.booking.groupBy).mockResolvedValue([
        { timeSlot: '10:00', _sum: { guestCount: 6 } },
      ] as never);

      const result = await getTimeSlotsForDate('exp-123', '2024-06-15'); // Saturday

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toEqual({
          timeSlot: '10:00',
          remainingCapacity: 4,
          available: true,
        });
        expect(result.data[1]).toEqual({
          timeSlot: '14:00',
          remainingCapacity: 10,
          available: true,
        });
      }
    });

    it('marks fully booked slots as unavailable', async () => {
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        id: 'exp-123',
        maxCapacity: 10,
        availabilitySlots: [{ startTime: '10:00', dayOfWeek: 6 }],
      } as never);
      vi.mocked(db.booking.groupBy).mockResolvedValue([
        { timeSlot: '10:00', _sum: { guestCount: 10 } },
      ] as never);

      const result = await getTimeSlotsForDate('exp-123', '2024-06-15');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0]?.available).toBe(false);
        expect(result.data[0]?.remainingCapacity).toBe(0);
      }
    });
  });

  describe('getExperienceForBooking', () => {
    it('returns NOT_FOUND when experience does not exist', async () => {
      vi.mocked(db.experience.findFirst).mockResolvedValue(null);

      const result = await getExperienceForBooking('test-experience');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns experience data when found', async () => {
      vi.mocked(db.experience.findFirst).mockResolvedValue({
        id: 'exp-123',
        title: 'Wine Tasting',
        slug: 'wine-tasting',
        price: 5000,
        minCapacity: 2,
        maxCapacity: 10,
        duration: 90,
        coverPhoto: 'https://example.com/photo.jpg',
        winery: {
          id: 'winery-123',
          name: 'Test Winery',
          stripeOnboardingComplete: true,
        },
        availabilitySlots: [
          { dayOfWeek: 6, startTime: '10:00', endTime: '11:30' },
        ],
      } as never);

      const result = await getExperienceForBooking('wine-tasting');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('exp-123');
        expect(result.data.title).toBe('Wine Tasting');
        expect(result.data.winery.stripeOnboardingComplete).toBe(true);
        expect(result.data.availabilitySlots).toHaveLength(1);
      }
    });

    it('only returns published experiences from verified wineries', async () => {
      await getExperienceForBooking('test-experience');

      expect(db.experience.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: 'test-experience',
            status: 'PUBLISHED',
            winery: { status: 'VERIFIED' },
          },
        })
      );
    });
  });
});
