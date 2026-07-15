import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));

vi.mock('@/server/db', () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    adminAction: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/server/services/anonymization.service', () => ({
  anonymizeUser: vi.fn(),
}));

// admin.ts imports these at module load — mock so the import stays hermetic.
vi.mock('@/server/services/email.service', () => ({
  sendManualRefundClientEmail: vi.fn(),
  sendManualRefundWinemakerEmail: vi.fn(),
  sendWineryApprovedEmail: vi.fn(),
  sendWineryRejectedEmail: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { anonymizeUser } from '@/server/services/anonymization.service';
import { changeUserRole, anonymizeUserAsAdmin } from '@/server/actions/admin';

const mockAuth = vi.mocked(auth);
const mockDb = vi.mocked(db);
const mockAnonymize = vi.mocked(anonymizeUser);

const ADMIN_ID = 'cjld2cjxh0000qzrmn831i7ra';
const TARGET_ID = 'cjld2cjxh0000qzrmn831i7rb';

const adminSession: Session = {
  user: {
    id: ADMIN_ID,
    email: 'admin@encave.ch',
    name: 'Admin',
    role: 'ADMIN',
    preferredLocale: 'FR',
  },
} as Session;

const clientSession: Session = {
  user: {
    id: 'cjld2cjxh0000qzrmn831i7rc',
    email: 'client@test.com',
    name: 'Client',
    role: 'CLIENT',
    preferredLocale: 'FR',
  },
} as Session;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.$transaction.mockResolvedValue([]);
});

describe('changeUserRole', () => {
  it('rejects a non-admin caller', async () => {
    mockAuth.mockResolvedValue(clientSession);
    const result = await changeUserRole({
      targetId: TARGET_ID,
      role: 'WINEMAKER',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('rejects an ADMIN role (schema — never assignable via UI)', async () => {
    mockAuth.mockResolvedValue(adminSession);
    const result = await changeUserRole({ targetId: TARGET_ID, role: 'ADMIN' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses to change your own role', async () => {
    mockAuth.mockResolvedValue(adminSession);
    const result = await changeUserRole({
      targetId: ADMIN_ID,
      role: 'WINEMAKER',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses to touch an ADMIN target', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockDb.user.findUnique.mockResolvedValue({
      role: 'ADMIN',
      winery: null,
    } as never);
    const result = await changeUserRole({
      targetId: TARGET_ID,
      role: 'CLIENT',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('refuses to demote a winery-owning WINEMAKER', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockDb.user.findUnique.mockResolvedValue({
      role: 'WINEMAKER',
      winery: { id: 'cjld2cjxh0000qzrmn831i7rw' },
    } as never);
    const result = await changeUserRole({
      targetId: TARGET_ID,
      role: 'CLIENT',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CONFLICT');
  });

  it('promotes CLIENT → WINEMAKER and journalizes it', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockDb.user.findUnique.mockResolvedValue({
      role: 'CLIENT',
      winery: null,
    } as never);
    const result = await changeUserRole({
      targetId: TARGET_ID,
      role: 'WINEMAKER',
    });
    expect(result.success).toBe(true);
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
    expect(mockDb.adminAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'USER_ROLE_CHANGED',
          targetType: 'User',
          metadata: { from: 'CLIENT', to: 'WINEMAKER' },
        }),
      })
    );
  });
});

describe('anonymizeUserAsAdmin', () => {
  it('rejects a non-admin caller', async () => {
    mockAuth.mockResolvedValue(clientSession);
    const result = await anonymizeUserAsAdmin({
      targetId: TARGET_ID,
      reason: 'legal erasure request',
      notifyUser: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('refuses to anonymize your own account', async () => {
    mockAuth.mockResolvedValue(adminSession);
    const result = await anonymizeUserAsAdmin({
      targetId: ADMIN_ID,
      reason: 'legal erasure request',
      notifyUser: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('delegates to the service with actor + notifyUser and returns success', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockAnonymize.mockResolvedValue({ alreadyAnonymized: false });
    const result = await anonymizeUserAsAdmin({
      targetId: TARGET_ID,
      reason: 'fraud — abusive account',
      notifyUser: false,
    });
    expect(result.success).toBe(true);
    expect(mockAnonymize).toHaveBeenCalledWith(TARGET_ID, {
      actorId: ADMIN_ID,
      reason: 'fraud — abusive account',
      notifyUser: false,
    });
  });

  it('maps FUTURE_WINERY_BOOKINGS to CONFLICT (never throws)', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockAnonymize.mockRejectedValue(new Error('FUTURE_WINERY_BOOKINGS:3'));
    const result = await anonymizeUserAsAdmin({
      targetId: TARGET_ID,
      reason: 'legal erasure request',
      notifyUser: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFLICT');
      expect(result.error.message).toContain('3');
    }
  });

  it('maps USER_NOT_FOUND to NOT_FOUND', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockAnonymize.mockRejectedValue(new Error('USER_NOT_FOUND'));
    const result = await anonymizeUserAsAdmin({
      targetId: TARGET_ID,
      reason: 'legal erasure request',
      notifyUser: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NOT_FOUND');
  });
});
