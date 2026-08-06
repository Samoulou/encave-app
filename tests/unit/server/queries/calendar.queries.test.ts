import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingStatus, ExperienceType } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(),
    },
    blockedDate: {
      findMany: vi.fn(),
    },
    experience: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { db } from '@/server/db';
import {
  getCalendarData,
  getMonthCalendarData,
  getWeekCalendarData,
  getBlockedDates,
  getWineryExperiencesForBlocking,
} from '@/server/queries/calendar.queries';

describe('calendar.queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockBookings = [
    {
      id: 'booking-1',
      reference: 'ENC-001',
      visitorName: 'John Doe',
      visitorEmail: 'john@example.com',
      visitorPhone: '+41791234567',
      date: new Date('2026-01-15'),
      timeSlot: '14:00',
      guestCount: 4,
      totalPrice: 20000,
      status: BookingStatus.CONFIRMED,
      experience: {
        id: 'exp-1',
        title: 'Wine Tasting',
        slug: 'wine-tasting',
        type: ExperienceType.TASTING,
        duration: 90,
      },
    },
    {
      id: 'booking-2',
      reference: 'ENC-002',
      visitorName: 'Jane Smith',
      visitorEmail: 'jane@example.com',
      visitorPhone: '+41799876543',
      date: new Date('2026-01-15'),
      timeSlot: '10:00',
      guestCount: 2,
      totalPrice: 10000,
      status: BookingStatus.CONFIRMED,
      experience: {
        id: 'exp-2',
        title: 'Cellar Tour',
        slug: 'cellar-tour',
        type: ExperienceType.CELLAR_VISIT,
        duration: 60,
      },
    },
    {
      id: 'booking-3',
      reference: 'ENC-003',
      visitorName: 'Bob Wilson',
      visitorEmail: 'bob@example.com',
      visitorPhone: '+41798765432',
      date: new Date('2026-01-20'),
      timeSlot: '11:00',
      guestCount: 6,
      totalPrice: 30000,
      status: BookingStatus.COMPLETED,
      experience: {
        id: 'exp-1',
        title: 'Wine Tasting',
        slug: 'wine-tasting',
        type: ExperienceType.TASTING,
        duration: 90,
      },
    },
  ];

  const mockBlockedDates = [
    { date: new Date('2026-01-18'), experienceId: 'exp-1' },
    { date: new Date('2026-01-18'), experienceId: 'exp-2' },
    { date: new Date('2026-01-25'), experienceId: 'exp-1' },
  ];

  describe('getCalendarData', () => {
    it('returns bookings grouped by date', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue(mockBookings as never);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      const result = await getCalendarData(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2); // Two unique dates with bookings
      expect(result.get('2026-01-15')?.bookingCount).toBe(2);
      expect(result.get('2026-01-20')?.bookingCount).toBe(1);
    });

    it('calculates total guests per day correctly', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue(mockBookings as never);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      const result = await getCalendarData(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      // Jan 15: 4 + 2 = 6 guests
      expect(result.get('2026-01-15')?.totalGuests).toBe(6);
      // Jan 20: 6 guests
      expect(result.get('2026-01-20')?.totalGuests).toBe(6);
    });

    it('collects unique experience types per day', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue(mockBookings as never);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      const result = await getCalendarData(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      // Jan 15 has both TASTING and CELLAR_VISIT
      const jan15Types = result.get('2026-01-15')?.experienceTypes;
      expect(jan15Types).toContain(ExperienceType.TASTING);
      expect(jan15Types).toContain(ExperienceType.CELLAR_VISIT);
      expect(jan15Types?.length).toBe(2);

      // Jan 20 has only TASTING
      const jan20Types = result.get('2026-01-20')?.experienceTypes;
      expect(jan20Types).toContain(ExperienceType.TASTING);
      expect(jan20Types?.length).toBe(1);
    });

    it('includes blocked experience IDs per day', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue(
        mockBlockedDates as never
      );

      const result = await getCalendarData(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      // Jan 18 has two blocked experiences
      const jan18 = result.get('2026-01-18');
      expect(jan18?.blockedExperienceIds).toContain('exp-1');
      expect(jan18?.blockedExperienceIds).toContain('exp-2');
      expect(jan18?.blockedExperienceIds.length).toBe(2);

      // Jan 25 has one blocked experience
      const jan25 = result.get('2026-01-25');
      expect(jan25?.blockedExperienceIds).toContain('exp-1');
      expect(jan25?.blockedExperienceIds.length).toBe(1);
    });

    it('filters by status when provided', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      await getCalendarData(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        [BookingStatus.CONFIRMED]
      );

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [BookingStatus.CONFIRMED] },
          }),
        })
      );
    });

    it('defaults to CONFIRMED and COMPLETED status when no filter provided', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      await getCalendarData(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          }),
        })
      );
    });

    it('orders bookings by date and time slot', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      await getCalendarData(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
        })
      );
    });

    it('returns empty map when no bookings or blocked dates', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      const result = await getCalendarData(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(result.size).toBe(0);
    });

    it('creates entries for dates with only blocked dates (no bookings)', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([
        { date: new Date('2026-01-18'), experienceId: 'exp-1' },
      ] as never);

      const result = await getCalendarData(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      const jan18 = result.get('2026-01-18');
      expect(jan18).toBeDefined();
      expect(jan18?.bookingCount).toBe(0);
      expect(jan18?.bookings).toHaveLength(0);
      expect(jan18?.blockedExperienceIds).toContain('exp-1');
    });
  });

  describe('getMonthCalendarData', () => {
    it('fetches data for the entire month', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      await getMonthCalendarData('winery-123', new Date('2026-01-15'));

      // Verify the booking query was made with date range covering January
      expect(db.booking.findMany).toHaveBeenCalled();
      const call = vi.mocked(db.booking.findMany).mock.calls[0];
      const whereClause = call?.[0]?.where;
      expect(whereClause?.wineryId).toBe('winery-123');
      expect(whereClause?.date?.gte).toBeDefined();
      expect(whereClause?.date?.lt).toBeDefined(); // Uses lt, not lte
    });

    it('passes status filter to getCalendarData', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      await getMonthCalendarData('winery-123', new Date('2026-01-15'), [
        BookingStatus.CONFIRMED,
      ]);

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [BookingStatus.CONFIRMED] },
          }),
        })
      );
    });
  });

  describe('getWeekCalendarData', () => {
    it('fetches data for the week starting on Monday', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      // Jan 15, 2026 is a Thursday
      await getWeekCalendarData('winery-123', new Date('2026-01-15'));

      // Verify the booking query was made with date range covering the week
      expect(db.booking.findMany).toHaveBeenCalled();
      const call = vi.mocked(db.booking.findMany).mock.calls[0];
      const whereClause = call?.[0]?.where;
      expect(whereClause?.wineryId).toBe('winery-123');
      expect(whereClause?.date?.gte).toBeDefined();
      expect(whereClause?.date?.lt).toBeDefined(); // Uses lt, not lte
    });

    it('passes status filter to getCalendarData', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([]);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      await getWeekCalendarData('winery-123', new Date('2026-01-15'), [
        BookingStatus.COMPLETED,
      ]);

      expect(db.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [BookingStatus.COMPLETED] },
          }),
        })
      );
    });
  });

  describe('getBlockedDates', () => {
    const mockBlockedDatesWithInfo = [
      {
        id: 'bd-1',
        experienceId: 'exp-1',
        date: new Date('2026-01-18'),
        reason: 'Holiday',
        experience: { title: 'Wine Tasting' },
      },
      {
        id: 'bd-2',
        experienceId: 'exp-2',
        date: new Date('2026-01-18'),
        reason: null,
        experience: { title: 'Cellar Tour' },
      },
    ];

    it('returns blocked dates with experience info', async () => {
      vi.mocked(db.blockedDate.findMany).mockResolvedValue(
        mockBlockedDatesWithInfo as never
      );

      const result = await getBlockedDates(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('bd-1');
      expect(result[0]?.experienceTitle).toBe('Wine Tasting');
      expect(result[0]?.reason).toBe('Holiday');
      expect(result[1]?.experienceTitle).toBe('Cellar Tour');
      expect(result[1]?.reason).toBeNull();
    });

    it('filters by winery through experience relation', async () => {
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      await getBlockedDates(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(db.blockedDate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            experience: { wineryId: 'winery-123' },
            date: expect.any(Object),
          },
        })
      );
    });

    it('orders by date ascending', async () => {
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      await getBlockedDates(
        'winery-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(db.blockedDate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'asc' },
        })
      );
    });
  });

  describe('getWineryExperiencesForBlocking', () => {
    const mockExperiences = [
      { id: 'exp-1', title: 'Wine Tasting', type: ExperienceType.TASTING },
      { id: 'exp-2', title: 'Cellar Tour', type: ExperienceType.CELLAR_VISIT },
    ];

    it('returns published experiences for blocking', async () => {
      vi.mocked(db.experience.findMany).mockResolvedValue(
        mockExperiences as never
      );

      const result = await getWineryExperiencesForBlocking('winery-123');

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('exp-1');
      expect(result[0]?.title).toBe('Wine Tasting');
      expect(result[0]?.type).toBe(ExperienceType.TASTING);
    });

    it('only returns PUBLISHED experiences', async () => {
      vi.mocked(db.experience.findMany).mockResolvedValue([]);

      await getWineryExperiencesForBlocking('winery-123');

      expect(db.experience.findMany).toHaveBeenCalledWith({
        where: { wineryId: 'winery-123', status: 'PUBLISHED' },
        select: { id: true, title: true, type: true },
        orderBy: { title: 'asc' },
      });
    });

    it('orders by title alphabetically', async () => {
      vi.mocked(db.experience.findMany).mockResolvedValue([]);

      await getWineryExperiencesForBlocking('winery-123');

      expect(db.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'asc' },
        })
      );
    });
  });
});
