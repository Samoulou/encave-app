import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    emailLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

import { db } from '@/server/db';
import {
  logEmailSent,
  logEmailFailed,
  logEmailSkipped,
} from '@/server/services/email-log.service';

const mockDb = vi.mocked(db);

describe('Email Log Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // logEmailSent
  // ========================================
  describe('logEmailSent', () => {
    it('creates a sent email log entry', async () => {
      mockDb.emailLog.create.mockResolvedValueOnce({} as never);

      await logEmailSent('reminder_24h', 'user-123', 'booking-456');

      expect(mockDb.emailLog.create).toHaveBeenCalledWith({
        data: {
          type: 'reminder_24h',
          recipientId: 'user-123',
          bookingId: 'booking-456',
          status: 'sent',
        },
      });
    });

    it('creates entry without bookingId', async () => {
      mockDb.emailLog.create.mockResolvedValueOnce({} as never);

      await logEmailSent('daily_digest', 'user-123');

      expect(mockDb.emailLog.create).toHaveBeenCalledWith({
        data: {
          type: 'daily_digest',
          recipientId: 'user-123',
          bookingId: undefined,
          status: 'sent',
        },
      });
    });

    it('does not throw when db fails', async () => {
      mockDb.emailLog.create.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        logEmailSent('reminder_24h', 'user-123')
      ).resolves.toBeUndefined();
    });

    it('logs error when db fails', async () => {
      const { logError } = await import('@/lib/logger');
      mockDb.emailLog.create.mockRejectedValueOnce(new Error('DB error'));

      await logEmailSent('reminder_24h', 'user-123');

      expect(logError).toHaveBeenCalledWith(
        'Failed to log sent email',
        expect.any(Error),
        { action: 'logEmailSent' }
      );
    });
  });

  // ========================================
  // logEmailFailed
  // ========================================
  describe('logEmailFailed', () => {
    it('creates a failed email log entry', async () => {
      mockDb.emailLog.create.mockResolvedValueOnce({} as never);

      await logEmailFailed(
        'reminder_2h',
        'user-123',
        'SMTP timeout',
        'booking-456'
      );

      expect(mockDb.emailLog.create).toHaveBeenCalledWith({
        data: {
          type: 'reminder_2h',
          recipientId: 'user-123',
          bookingId: 'booking-456',
          status: 'failed',
          errorMessage: 'SMTP timeout',
        },
      });
    });

    it('does not throw when db fails', async () => {
      mockDb.emailLog.create.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        logEmailFailed('reminder_2h', 'user-123', 'SMTP timeout')
      ).resolves.toBeUndefined();
    });
  });

  // ========================================
  // logEmailSkipped
  // ========================================
  describe('logEmailSkipped', () => {
    it('creates a skipped email log entry', async () => {
      mockDb.emailLog.create.mockResolvedValueOnce({} as never);

      await logEmailSkipped('follow_up', 'user-123', 'User unsubscribed');

      expect(mockDb.emailLog.create).toHaveBeenCalledWith({
        data: {
          type: 'follow_up',
          recipientId: 'user-123',
          bookingId: undefined,
          status: 'skipped',
          errorMessage: 'User unsubscribed',
        },
      });
    });

    it('does not throw when db fails', async () => {
      mockDb.emailLog.create.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        logEmailSkipped('follow_up', 'user-123', 'reason')
      ).resolves.toBeUndefined();
    });
  });
});
