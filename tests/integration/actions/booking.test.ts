import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the db module
// Public read actions are rate-limited per IP (reads next/headers): the
// limiter is out of scope here — always let the call through.
vi.mock('@/server/services/rate-limit.service', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/server/services/rate-limit.service')
  >()),
  rateLimitPublicRead: vi.fn().mockResolvedValue(null),
}));

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
    featureFlag: {
      findMany: vi.fn(),
    },
    experienceOccurrence: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    blockedDate: {
      findUnique: vi.fn(),
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
    // OCCURRENCE_CAPACITY defaults ON (P-05): the occurrence world's
    // defaults are "nothing materialized yet" — no blackout, no
    // occurrence rows — which must behave exactly like the legacy path
    // (defensive union, ADR-0002).
    vi.mocked(db.featureFlag.findMany).mockResolvedValue([] as never);
    vi.mocked(db.blockedDate.findUnique).mockResolvedValue(null);
    vi.mocked(db.experienceOccurrence.findUnique).mockResolvedValue(null);
    vi.mocked(db.experienceOccurrence.findMany).mockResolvedValue([] as never);
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

    it('counts seat-holding statuses (CONFIRMED, COMPLETED, NO_SHOW) plus non-expired PENDING_PAYMENT holds (L-050)', async () => {
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
            // A checked-in (COMPLETED) or no-show seat was sold and is
            // physically taken: it must never be offered again.
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
                status: BookingStatus.PENDING_PAYMENT,
                expiresAt: { gt: expect.any(Date) },
              },
            ],
          }),
        })
      );
    });
  });

  describe('getTimeSlotsForDate', () => {
    // Slots that have already started are hidden — pin "now" two weeks
    // before the fixture date (Saturday 2024-06-15) so its slots are future.
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-01T08:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

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
          { startTime: '10:00', endTime: '11:00', dayOfWeek: 6 },
          { startTime: '14:00', endTime: '15:00', dayOfWeek: 6 },
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
          endTime: '11:00',
          remainingCapacity: 4,
          maxCapacity: 10,
          available: true,
        });
        expect(result.data[1]).toEqual({
          timeSlot: '14:00',
          endTime: '15:00',
          remainingCapacity: 10,
          maxCapacity: 10,
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

    it("hides today's slots that have already started (Zurich wall clock)", async () => {
      // 2024-06-15 11:30 in Zurich (CEST = UTC+2): the 10:00 session has
      // started, the 14:00 one has not.
      vi.setSystemTime(new Date('2024-06-15T09:30:00.000Z'));
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        id: 'exp-123',
        maxCapacity: 10,
        availabilitySlots: [
          { startTime: '10:00', endTime: '11:00', dayOfWeek: 6 },
          { startTime: '14:00', endTime: '15:00', dayOfWeek: 6 },
        ],
      } as never);
      vi.mocked(db.booking.groupBy).mockResolvedValue([]);

      const result = await getTimeSlotsForDate('exp-123', '2024-06-15');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.map((slot) => slot.timeSlot)).toEqual(['14:00']);
      }
    });

    it('offers no slot at all for a past date', async () => {
      vi.setSystemTime(new Date('2024-06-16T08:00:00.000Z'));
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        id: 'exp-123',
        maxCapacity: 10,
        availabilitySlots: [
          { startTime: '10:00', endTime: '11:00', dayOfWeek: 6 },
        ],
      } as never);
      vi.mocked(db.booking.groupBy).mockResolvedValue([]);

      const result = await getTimeSlotsForDate('exp-123', '2024-06-15');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
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
