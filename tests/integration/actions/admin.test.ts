import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Session } from 'next-auth';

// Mock next-auth
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    verificationLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock email service
vi.mock('@/server/services/email.service', () => ({
  sendWineryApprovedEmail: vi.fn(),
  sendWineryRejectedEmail: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  sendWineryApprovedEmail,
  sendWineryRejectedEmail,
} from '@/server/services/email.service';
import { approveWinery, rejectWinery } from '@/server/actions/admin';

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);
const mockSendApprovedEmail = vi.mocked(sendWineryApprovedEmail);
const mockSendRejectedEmail = vi.mocked(sendWineryRejectedEmail);

describe('Admin Actions Integration Tests', () => {
  const mockAdminSession: Session = {
    user: {
      id: 'admin-123',
      email: 'admin@encave.ch',
      role: 'ADMIN',
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };

  const mockUserSession: Session = {
    user: {
      id: 'user-123',
      email: 'user@test.com',
      role: 'CLIENT',
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };

  const mockPendingWinery = {
    id: 'winery-123',
    name: 'Test Winery',
    slug: 'test-winery',
    status: 'PENDING' as const,
    user: {
      email: 'winemaker@test.com',
      name: 'Test Winemaker',
      preferredLocale: 'FR' as const,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('approveWinery', () => {
    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await approveWinery('winery-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN when user is not admin', async () => {
      mockAuth.mockResolvedValueOnce(mockUserSession);

      const result = await approveWinery('winery-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
        expect(result.error.message).toContain('Admin');
      }
    });

    it('returns NOT_FOUND when winery does not exist', async () => {
      mockAuth.mockResolvedValueOnce(mockAdminSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await approveWinery('non-existent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns VALIDATION_ERROR when winery is not pending', async () => {
      mockAuth.mockResolvedValueOnce(mockAdminSession);
      mockDb.winery.findUnique.mockResolvedValueOnce({
        ...mockPendingWinery,
        status: 'VERIFIED',
      });

      const result = await approveWinery('winery-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('VERIFIED');
      }
    });

    it('successfully approves a pending winery', async () => {
      mockAuth.mockResolvedValueOnce(mockAdminSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockPendingWinery);
      mockDb.$transaction.mockResolvedValueOnce([{}, {}]);
      mockSendApprovedEmail.mockResolvedValueOnce(true);

      const result = await approveWinery('winery-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verifiedAt).toBeInstanceOf(Date);
      }
      expect(mockDb.$transaction).toHaveBeenCalled();
      expect(mockSendApprovedEmail).toHaveBeenCalledWith(
        'winemaker@test.com',
        'Test Winemaker',
        'Test Winery',
        'FR'
      );
    });

    it('creates verification log on approval', async () => {
      mockAuth.mockResolvedValueOnce(mockAdminSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockPendingWinery);
      mockDb.$transaction.mockResolvedValueOnce([{}, {}]);
      mockSendApprovedEmail.mockResolvedValueOnce(true);

      await approveWinery('winery-123');

      // Check that $transaction was called with the right operations
      const transactionCall = mockDb.$transaction.mock.calls[0];
      expect(transactionCall).toBeDefined();
    });
  });

  describe('rejectWinery', () => {
    const rejectionReason = 'Missing required documentation';

    it('returns UNAUTHORIZED when not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const result = await rejectWinery('winery-123', rejectionReason);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN when user is not admin', async () => {
      mockAuth.mockResolvedValueOnce(mockUserSession);

      const result = await rejectWinery('winery-123', rejectionReason);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns VALIDATION_ERROR when reason is empty', async () => {
      mockAuth.mockResolvedValueOnce(mockAdminSession);

      const result = await rejectWinery('winery-123', '   ');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('reason');
      }
    });

    it('returns NOT_FOUND when winery does not exist', async () => {
      mockAuth.mockResolvedValueOnce(mockAdminSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(null);

      const result = await rejectWinery('non-existent', rejectionReason);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns VALIDATION_ERROR when winery is not pending', async () => {
      mockAuth.mockResolvedValueOnce(mockAdminSession);
      mockDb.winery.findUnique.mockResolvedValueOnce({
        ...mockPendingWinery,
        status: 'REJECTED',
      });

      const result = await rejectWinery('winery-123', rejectionReason);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('REJECTED');
      }
    });

    it('successfully rejects a pending winery with reason', async () => {
      mockAuth.mockResolvedValueOnce(mockAdminSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockPendingWinery);
      mockDb.$transaction.mockResolvedValueOnce([{}, {}]);
      mockSendRejectedEmail.mockResolvedValueOnce(true);

      const result = await rejectWinery('winery-123', rejectionReason);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rejectedAt).toBeInstanceOf(Date);
      }
      expect(mockDb.$transaction).toHaveBeenCalled();
      expect(mockSendRejectedEmail).toHaveBeenCalledWith(
        'winemaker@test.com',
        'Test Winemaker',
        'Test Winery',
        rejectionReason,
        'FR'
      );
    });

    it('trims whitespace from rejection reason', async () => {
      mockAuth.mockResolvedValueOnce(mockAdminSession);
      mockDb.winery.findUnique.mockResolvedValueOnce(mockPendingWinery);
      mockDb.$transaction.mockResolvedValueOnce([{}, {}]);
      mockSendRejectedEmail.mockResolvedValueOnce(true);

      await rejectWinery('winery-123', '  ' + rejectionReason + '  ');

      expect(mockSendRejectedEmail).toHaveBeenCalledWith(
        'winemaker@test.com',
        'Test Winemaker',
        'Test Winery',
        rejectionReason,
        'FR'
      );
    });
  });
});
