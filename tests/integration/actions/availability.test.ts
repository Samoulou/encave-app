import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from '@/server/auth';

// Mock auth
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn() },
    experience: { findFirst: vi.fn(), findUnique: vi.fn() },
    availabilitySlot: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    blockedDate: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock hasOverlappingSlots
vi.mock('@/lib/constants/time-slots', () => ({
  hasOverlappingSlots: vi.fn(() => false),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { hasOverlappingSlots } from '@/lib/constants/time-slots';
import {
  getAvailabilitySlots,
  updateAvailabilitySlots,
  toggleSlotActive,
  blockDate,
  unblockDate,
  blockDateForAllExperiences,
  unblockDateForAllExperiences,
  getBlockedDatesForExperience,
} from '@/server/actions/availability';

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);

describe('Availability Actions', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'winemaker@test.com',
      name: 'Test User',
      role: 'WINEMAKER',
      preferredLocale: 'FR',
    },
  };

  const mockWinery = { id: 'winery-123' };
  const mockExperience = { id: 'exp-123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // getAvailabilitySlots
  // ========================================
  describe('getAvailabilitySlots', () => {
    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await getAvailabilitySlots('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await getAvailabilitySlots('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('Winery');
      }
    });

    it('returns NOT_FOUND when experience not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.experience.findFirst.mockResolvedValueOnce(null);

      const result = await getAvailabilitySlots('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('Experience');
      }
    });

    it('returns availability slots successfully', async () => {
      const mockSlots = [
        {
          id: 'slot-1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '12:00',
          isActive: true,
        },
        {
          id: 'slot-2',
          dayOfWeek: 3,
          startTime: '14:00',
          endTime: '17:00',
          isActive: false,
        },
      ];

      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.experience.findFirst.mockResolvedValueOnce(
        mockExperience as never
      );
      mockDb.availabilitySlot.findMany.mockResolvedValueOnce(
        mockSlots as never
      );

      const result = await getAvailabilitySlots('exp-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe('slot-1');
        expect(result.data[1].isActive).toBe(false);
      }
    });

    it('returns INTERNAL_ERROR when db throws', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockRejectedValueOnce(new Error('DB error'));

      const result = await getAvailabilitySlots('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  // ========================================
  // updateAvailabilitySlots
  // ========================================
  describe('updateAvailabilitySlots', () => {
    const validSlots = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
      { dayOfWeek: 3, startTime: '14:00', endTime: '17:00', isActive: true },
    ];

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await updateAvailabilitySlots('exp-123', validSlots);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await updateAvailabilitySlots('exp-123', validSlots);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns NOT_FOUND when experience not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.experience.findFirst.mockResolvedValueOnce(null);

      const result = await updateAvailabilitySlots('exp-123', validSlots);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns VALIDATION_ERROR for overlapping slots', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.experience.findFirst.mockResolvedValueOnce(
        mockExperience as never
      );
      vi.mocked(hasOverlappingSlots).mockReturnValueOnce(true);

      const overlappingSlots = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', isActive: true },
        { dayOfWeek: 1, startTime: '11:00', endTime: '14:00', isActive: true },
      ];

      const result = await updateAvailabilitySlots('exp-123', overlappingSlots);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Overlapping');
      }
    });

    it('returns VALIDATION_ERROR for invalid time format', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.experience.findFirst.mockResolvedValueOnce(
        mockExperience as never
      );

      const invalidSlots = [
        { dayOfWeek: 1, startTime: '9:00', endTime: '12:00', isActive: true },
      ];

      const result = await updateAvailabilitySlots('exp-123', invalidSlots);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('HH:mm');
      }
    });

    it('returns VALIDATION_ERROR when end time before start time', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.experience.findFirst.mockResolvedValueOnce(
        mockExperience as never
      );

      const invalidSlots = [
        { dayOfWeek: 1, startTime: '14:00', endTime: '09:00', isActive: true },
      ];

      const result = await updateAvailabilitySlots('exp-123', invalidSlots);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('after start time');
      }
    });

    it('returns VALIDATION_ERROR for invalid day of week', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.experience.findFirst.mockResolvedValueOnce(
        mockExperience as never
      );

      const invalidSlots = [
        { dayOfWeek: 7, startTime: '09:00', endTime: '12:00', isActive: true },
      ];

      const result = await updateAvailabilitySlots('exp-123', invalidSlots);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('day of week');
      }
    });

    it('successfully updates slots via transaction', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.experience.findFirst.mockResolvedValueOnce(
        mockExperience as never
      );
      mockDb.$transaction.mockImplementationOnce(async (fn: Function) => {
        await fn({
          availabilitySlot: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
        });
      });

      const result = await updateAvailabilitySlots('exp-123', validSlots);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(2);
      }
    });

    it('handles empty slots array', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.experience.findFirst.mockResolvedValueOnce(
        mockExperience as never
      );
      mockDb.$transaction.mockImplementationOnce(async (fn: Function) => {
        await fn({
          availabilitySlot: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
        });
      });

      const result = await updateAvailabilitySlots('exp-123', []);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(0);
      }
    });
  });

  // ========================================
  // toggleSlotActive
  // ========================================
  describe('toggleSlotActive', () => {
    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await toggleSlotActive('slot-1', false);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await toggleSlotActive('slot-1', false);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns NOT_FOUND when slot not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.availabilitySlot.findFirst.mockResolvedValueOnce(null);

      const result = await toggleSlotActive('slot-1', false);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns NOT_FOUND when slot belongs to different winery', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.availabilitySlot.findFirst.mockResolvedValueOnce({
        id: 'slot-1',
        experience: { wineryId: 'other-winery' },
      } as never);

      const result = await toggleSlotActive('slot-1', false);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('successfully toggles slot active status', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.availabilitySlot.findFirst.mockResolvedValueOnce({
        id: 'slot-1',
        experience: { wineryId: 'winery-123' },
      } as never);
      mockDb.availabilitySlot.update.mockResolvedValueOnce({} as never);

      const result = await toggleSlotActive('slot-1', false);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
    });
  });

  // ========================================
  // blockDate
  // ========================================
  describe('blockDate', () => {
    const testDate = new Date('2025-06-15');

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await blockDate('exp-123', testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when experience not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.experience.findUnique.mockResolvedValueOnce(null);

      const result = await blockDate('exp-123', testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns FORBIDDEN when user does not own experience', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.experience.findUnique.mockResolvedValueOnce({
        id: 'exp-123',
        winery: { userId: 'other-user' },
      } as never);

      const result = await blockDate('exp-123', testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns CONFLICT when date already blocked', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.experience.findUnique.mockResolvedValueOnce({
        id: 'exp-123',
        winery: { userId: 'user-123' },
      } as never);
      mockDb.blockedDate.findUnique.mockResolvedValueOnce({
        id: 'bd-1',
      } as never);

      const result = await blockDate('exp-123', testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONFLICT');
      }
    });

    it('successfully blocks a date', async () => {
      const normalizedDate = new Date(Date.UTC(2025, 5, 15));
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.experience.findUnique.mockResolvedValueOnce({
        id: 'exp-123',
        winery: { userId: 'user-123' },
      } as never);
      mockDb.blockedDate.findUnique.mockResolvedValueOnce(null);
      mockDb.blockedDate.create.mockResolvedValueOnce({
        id: 'bd-new',
        experienceId: 'exp-123',
        date: normalizedDate,
      } as never);

      const result = await blockDate('exp-123', testDate, 'Holiday');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('bd-new');
        expect(result.data.experienceId).toBe('exp-123');
      }
    });
  });

  // ========================================
  // unblockDate
  // ========================================
  describe('unblockDate', () => {
    const testDate = new Date('2025-06-15');

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await unblockDate('exp-123', testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN when user does not own experience', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.experience.findUnique.mockResolvedValueOnce({
        id: 'exp-123',
        winery: { userId: 'other-user' },
      } as never);

      const result = await unblockDate('exp-123', testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('successfully unblocks a date', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.experience.findUnique.mockResolvedValueOnce({
        id: 'exp-123',
        winery: { userId: 'user-123' },
      } as never);
      mockDb.blockedDate.deleteMany.mockResolvedValueOnce({
        count: 1,
      } as never);

      const result = await unblockDate('exp-123', testDate);

      expect(result.success).toBe(true);
    });
  });

  // ========================================
  // blockDateForAllExperiences
  // ========================================
  describe('blockDateForAllExperiences', () => {
    const testDate = new Date('2025-06-15');

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await blockDateForAllExperiences(testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await blockDateForAllExperiences(testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('successfully blocks date for all experiences', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce({
        id: 'winery-123',
        experiences: [{ id: 'exp-1' }, { id: 'exp-2' }],
      } as never);
      mockDb.blockedDate.createMany.mockResolvedValueOnce({
        count: 2,
      } as never);

      const result = await blockDateForAllExperiences(testDate, 'Holiday');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.blockedCount).toBe(2);
      }
    });
  });

  // ========================================
  // unblockDateForAllExperiences
  // ========================================
  describe('unblockDateForAllExperiences', () => {
    const testDate = new Date('2025-06-15');

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await unblockDateForAllExperiences(testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await unblockDateForAllExperiences(testDate);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('successfully unblocks date for all experiences', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.blockedDate.deleteMany.mockResolvedValueOnce({
        count: 3,
      } as never);

      const result = await unblockDateForAllExperiences(testDate);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.unblockedCount).toBe(3);
      }
    });
  });

  // ========================================
  // getBlockedDatesForExperience
  // ========================================
  describe('getBlockedDatesForExperience', () => {
    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await getBlockedDatesForExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when experience not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.experience.findUnique.mockResolvedValueOnce(null);

      const result = await getBlockedDatesForExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns FORBIDDEN when user does not own experience', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.experience.findUnique.mockResolvedValueOnce({
        id: 'exp-123',
        winery: { userId: 'other-user' },
      } as never);

      const result = await getBlockedDatesForExperience('exp-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('successfully returns blocked dates', async () => {
      const dates = [
        { date: new Date('2025-06-15') },
        { date: new Date('2025-06-20') },
      ];

      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.experience.findUnique.mockResolvedValueOnce({
        id: 'exp-123',
        winery: { userId: 'user-123' },
      } as never);
      mockDb.blockedDate.findMany.mockResolvedValueOnce(dates as never);

      const result = await getBlockedDatesForExperience('exp-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dates).toHaveLength(2);
      }
    });
  });
});
