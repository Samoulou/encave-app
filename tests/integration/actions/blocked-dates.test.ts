import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    experience: {
      findUnique: vi.fn(),
    },
    winery: {
      findUnique: vi.fn(),
    },
    blockedDate: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';

describe('Blocked Date Server Actions', () => {
  const mockSession = {
    user: { id: 'user-123', email: 'winemaker@example.com' },
  };

  const mockExperience = {
    id: 'exp-123',
    title: 'Wine Tasting',
    winery: { userId: 'user-123' },
  };

  const mockWinery = {
    id: 'winery-123',
    experiences: [
      { id: 'exp-1' },
      { id: 'exp-2' },
      { id: 'exp-3' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('blockDate', () => {
    it('blocks a date for an experience', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(mockExperience as never);
      vi.mocked(db.blockedDate.findUnique).mockResolvedValue(null);
      vi.mocked(db.blockedDate.create).mockResolvedValue({
        id: 'bd-123',
        experienceId: 'exp-123',
        date: new Date('2026-01-20'),
      } as never);

      const { blockDate } = await import('@/server/actions/availability');
      const result = await blockDate('exp-123', new Date('2026-01-20'));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('bd-123');
        expect(result.data.experienceId).toBe('exp-123');
      }
      expect(db.blockedDate.create).toHaveBeenCalledWith({
        data: {
          experienceId: 'exp-123',
          date: expect.any(Date),
          reason: undefined,
        },
      });
    });

    it('includes reason when provided', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(mockExperience as never);
      vi.mocked(db.blockedDate.findUnique).mockResolvedValue(null);
      vi.mocked(db.blockedDate.create).mockResolvedValue({
        id: 'bd-123',
        experienceId: 'exp-123',
        date: new Date('2026-01-20'),
      } as never);

      const { blockDate } = await import('@/server/actions/availability');
      await blockDate('exp-123', new Date('2026-01-20'), 'Holiday closure');

      expect(db.blockedDate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reason: 'Holiday closure',
        }),
      });
    });

    it('returns UNAUTHORIZED when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const { blockDate } = await import('@/server/actions/availability');
      const result = await blockDate('exp-123', new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when experience does not exist', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(null);

      const { blockDate } = await import('@/server/actions/availability');
      const result = await blockDate('exp-123', new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns FORBIDDEN when user does not own experience', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        ...mockExperience,
        winery: { userId: 'other-user' },
      } as never);

      const { blockDate } = await import('@/server/actions/availability');
      const result = await blockDate('exp-123', new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns CONFLICT when date is already blocked', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(mockExperience as never);
      vi.mocked(db.blockedDate.findUnique).mockResolvedValue({
        id: 'existing-bd',
        experienceId: 'exp-123',
        date: new Date('2026-01-20'),
      } as never);

      const { blockDate } = await import('@/server/actions/availability');
      const result = await blockDate('exp-123', new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONFLICT');
        expect(result.error.message).toContain('already blocked');
      }
    });
  });

  describe('unblockDate', () => {
    it('unblocks a date for an experience', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(mockExperience as never);
      vi.mocked(db.blockedDate.deleteMany).mockResolvedValue({ count: 1 } as never);

      const { unblockDate } = await import('@/server/actions/availability');
      const result = await unblockDate('exp-123', new Date('2026-01-20'));

      expect(result.success).toBe(true);
      expect(db.blockedDate.deleteMany).toHaveBeenCalledWith({
        where: {
          experienceId: 'exp-123',
          date: expect.any(Date),
        },
      });
    });

    it('returns UNAUTHORIZED when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const { unblockDate } = await import('@/server/actions/availability');
      const result = await unblockDate('exp-123', new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when experience does not exist', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(null);

      const { unblockDate } = await import('@/server/actions/availability');
      const result = await unblockDate('exp-123', new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns FORBIDDEN when user does not own experience', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        ...mockExperience,
        winery: { userId: 'other-user' },
      } as never);

      const { unblockDate } = await import('@/server/actions/availability');
      const result = await unblockDate('exp-123', new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('blockDateForAllExperiences', () => {
    it('blocks a date for all published experiences', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.blockedDate.create).mockResolvedValue({} as never);

      const { blockDateForAllExperiences } = await import(
        '@/server/actions/availability'
      );
      const result = await blockDateForAllExperiences(new Date('2026-01-20'));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.blockedCount).toBe(3);
      }
      expect(db.blockedDate.create).toHaveBeenCalledTimes(3);
    });

    it('includes reason when provided', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);
      vi.mocked(db.blockedDate.create).mockResolvedValue({} as never);

      const { blockDateForAllExperiences } = await import(
        '@/server/actions/availability'
      );
      await blockDateForAllExperiences(new Date('2026-01-20'), 'Annual closure');

      expect(db.blockedDate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reason: 'Annual closure',
        }),
      });
    });

    it('skips already blocked dates (unique constraint)', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(mockWinery as never);

      // First two succeed, third fails with unique constraint
      vi.mocked(db.blockedDate.create)
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({} as never)
        .mockRejectedValueOnce(new Error('Unique constraint failed'));

      const { blockDateForAllExperiences } = await import(
        '@/server/actions/availability'
      );
      const result = await blockDateForAllExperiences(new Date('2026-01-20'));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.blockedCount).toBe(2); // Only 2 succeeded
      }
    });

    it('returns UNAUTHORIZED when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const { blockDateForAllExperiences } = await import(
        '@/server/actions/availability'
      );
      const result = await blockDateForAllExperiences(new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery does not exist', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(null);

      const { blockDateForAllExperiences } = await import(
        '@/server/actions/availability'
      );
      const result = await blockDateForAllExperiences(new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('unblockDateForAllExperiences', () => {
    it('unblocks a date for all experiences of the winery', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue({ id: 'winery-123' } as never);
      vi.mocked(db.blockedDate.deleteMany).mockResolvedValue({ count: 3 } as never);

      const { unblockDateForAllExperiences } = await import(
        '@/server/actions/availability'
      );
      const result = await unblockDateForAllExperiences(new Date('2026-01-20'));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.unblockedCount).toBe(3);
      }
      expect(db.blockedDate.deleteMany).toHaveBeenCalledWith({
        where: {
          date: expect.any(Date),
          experience: { wineryId: 'winery-123' },
        },
      });
    });

    it('returns UNAUTHORIZED when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const { unblockDateForAllExperiences } = await import(
        '@/server/actions/availability'
      );
      const result = await unblockDateForAllExperiences(new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery does not exist', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.winery.findUnique).mockResolvedValue(null);

      const { unblockDateForAllExperiences } = await import(
        '@/server/actions/availability'
      );
      const result = await unblockDateForAllExperiences(new Date('2026-01-20'));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getBlockedDatesForExperience', () => {
    it('returns blocked dates for an experience', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(mockExperience as never);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([
        { date: new Date('2026-01-20') },
        { date: new Date('2026-01-25') },
        { date: new Date('2026-02-01') },
      ] as never);

      const { getBlockedDatesForExperience } = await import(
        '@/server/actions/availability'
      );
      const result = await getBlockedDatesForExperience('exp-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dates).toHaveLength(3);
      }
    });

    it('orders dates ascending', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(mockExperience as never);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      const { getBlockedDatesForExperience } = await import(
        '@/server/actions/availability'
      );
      await getBlockedDatesForExperience('exp-123');

      expect(db.blockedDate.findMany).toHaveBeenCalledWith({
        where: { experienceId: 'exp-123' },
        select: { date: true },
        orderBy: { date: 'asc' },
      });
    });

    it('returns UNAUTHORIZED when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const { getBlockedDatesForExperience } = await import(
        '@/server/actions/availability'
      );
      const result = await getBlockedDatesForExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when experience does not exist', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(null);

      const { getBlockedDatesForExperience } = await import(
        '@/server/actions/availability'
      );
      const result = await getBlockedDatesForExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns FORBIDDEN when user does not own experience', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue({
        ...mockExperience,
        winery: { userId: 'other-user' },
      } as never);

      const { getBlockedDatesForExperience } = await import(
        '@/server/actions/availability'
      );
      const result = await getBlockedDatesForExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns empty array when no dates are blocked', async () => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(db.experience.findUnique).mockResolvedValue(mockExperience as never);
      vi.mocked(db.blockedDate.findMany).mockResolvedValue([]);

      const { getBlockedDatesForExperience } = await import(
        '@/server/actions/availability'
      );
      const result = await getBlockedDatesForExperience('exp-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dates).toEqual([]);
      }
    });
  });
});
