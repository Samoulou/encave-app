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
    notificationPreferences: {
      upsert: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  updateNotificationPreferences,
  getNotificationPreferences,
} from '@/server/actions/notifications';

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);

describe('Notification Actions', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'winemaker@test.com',
      name: 'Test User',
      role: 'WINEMAKER',
      preferredLocale: 'FR',
    },
  };

  const mockWinery = {
    id: 'winery-123',
    notificationPreferences: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // updateNotificationPreferences
  // ========================================
  describe('updateNotificationPreferences', () => {
    const validInput = {
      dailyDigest: true,
      weeklySummary: false,
      instantBookingAlerts: true,
    };

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await updateNotificationPreferences(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns VALIDATION_ERROR for invalid input', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);

      const result = await updateNotificationPreferences({
        dailyDigest: 'invalid' as unknown as boolean,
        weeklySummary: false,
        instantBookingAlerts: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns NOT_FOUND when winery not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await updateNotificationPreferences(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('successfully upserts notification preferences', async () => {
      const updatedAt = new Date();
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockWinery as never);
      mockDb.notificationPreferences.upsert.mockResolvedValueOnce({
        updatedAt,
        ...validInput,
      } as never);

      const result = await updateNotificationPreferences(validInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updatedAt).toEqual(updatedAt);
      }
      expect(mockDb.notificationPreferences.upsert).toHaveBeenCalledWith({
        where: { wineryId: 'winery-123' },
        update: validInput,
        create: { wineryId: 'winery-123', ...validInput },
      });
    });

    it('returns INTERNAL_ERROR on failure', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockRejectedValueOnce(new Error('DB error'));

      const result = await updateNotificationPreferences(validInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  // ========================================
  // getNotificationPreferences
  // ========================================
  describe('getNotificationPreferences', () => {
    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await getNotificationPreferences();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND when winery not found', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await getNotificationPreferences();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns existing preferences', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce({
        id: 'winery-123',
        notificationPreferences: {
          dailyDigest: false,
          weeklySummary: true,
          instantBookingAlerts: true,
          unsubscribeToken: 'token-abc',
        },
      } as never);

      const result = await getNotificationPreferences();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dailyDigest).toBe(false);
        expect(result.data.weeklySummary).toBe(true);
        expect(result.data.instantBookingAlerts).toBe(true);
      }
    });

    it('creates default preferences when none exist', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockResolvedValueOnce({
        id: 'winery-123',
        notificationPreferences: null,
      } as never);
      mockDb.notificationPreferences.create.mockResolvedValueOnce({
        dailyDigest: true,
        weeklySummary: true,
        instantBookingAlerts: true,
        unsubscribeToken: 'new-token',
      } as never);

      const result = await getNotificationPreferences();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dailyDigest).toBe(true);
        expect(result.data.weeklySummary).toBe(true);
        expect(result.data.instantBookingAlerts).toBe(true);
      }
      expect(mockDb.notificationPreferences.create).toHaveBeenCalledWith({
        data: {
          wineryId: 'winery-123',
          dailyDigest: true,
          weeklySummary: true,
          instantBookingAlerts: true,
        },
      });
    });

    it('returns INTERNAL_ERROR on failure', async () => {
      mockAuth.mockResolvedValueOnce(mockSession);
      mockDb.winery.findUnique.mockRejectedValueOnce(new Error('DB error'));

      const result = await getNotificationPreferences();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
