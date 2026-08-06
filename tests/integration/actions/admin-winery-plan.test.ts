import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, WineryPlan } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminAction: {
      create: vi.fn(),
    },
    // Array form: resolve the already-started promises in order.
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
  // G-3 boundary check (P-16) — not expired by default in tests.
  isCurrentAdminSessionExpired: vi.fn(async () => false),
}));

vi.mock('@/server/services/email.service', () => ({
  sendManualRefundClientEmail: vi.fn(),
  sendManualRefundWinemakerEmail: vi.fn(),
  sendWineryApprovedEmail: vi.fn(),
  sendWineryRejectedEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { auth } = await import('@/server/auth');
const { logInfo } = await import('@/lib/logger');
const { revalidateTag } = await import('next/cache');
const { setWineryPlan } = await import('@/server/actions/admin');

const adminSession = {
  user: { id: 'admin-1', role: UserRole.ADMIN },
} as never;

describe('setWineryPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated calls', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await setWineryPlan('winery-1', WineryPlan.FOUNDER, 0);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('rejects non-admin users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', role: UserRole.WINEMAKER },
    } as never);

    const result = await setWineryPlan('winery-1', WineryPlan.FOUNDER, 0);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('rejects an out-of-bounds commission rate', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession);

    const result = await setWineryPlan('winery-1', WineryPlan.STANDARD, 150);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(db.winery.findUnique).not.toHaveBeenCalled();
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown plan value', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession);

    const result = await setWineryPlan(
      'winery-1',
      'PLATINUM' as WineryPlan,
      10
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the winery does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(db.winery.findUnique).mockResolvedValue(null);

    const result = await setWineryPlan('missing', WineryPlan.STANDARD, 10);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('stores the UI percentage as a 0-1 fraction and logs the change', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'winery-1',
      slug: 'cave-test',
    } as never);
    vi.mocked(db.winery.update).mockResolvedValue({
      plan: WineryPlan.FOUNDER,
      commissionRate: 0,
    } as never);

    const result = await setWineryPlan('winery-1', WineryPlan.FOUNDER, 0);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        plan: WineryPlan.FOUNDER,
        commissionRate: 0,
      });
    }
    expect(db.winery.update).toHaveBeenCalledWith({
      where: { id: 'winery-1' },
      data: { plan: WineryPlan.FOUNDER, commissionRate: 0 },
    });
    // Money-touching admin change: mandatory audit log + cache invalidation
    expect(db.adminAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'WINERY_PLAN_UPDATED',
          targetType: 'Winery',
        }),
      })
    );
    expect(logInfo).toHaveBeenCalledWith(
      'winery-plan.updated',
      expect.objectContaining({ wineryId: 'winery-1', adminId: 'admin-1' })
    );
    expect(revalidateTag).toHaveBeenCalledWith('wineries');
  });

  it('stores null to fall back to the platform default rate', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'winery-1',
      slug: 'cave-test',
    } as never);
    vi.mocked(db.winery.update).mockResolvedValue({
      plan: WineryPlan.STANDARD,
      commissionRate: null,
    } as never);

    const result = await setWineryPlan('winery-1', WineryPlan.STANDARD, null);

    expect(result.success).toBe(true);
    expect(db.winery.update).toHaveBeenCalledWith({
      where: { id: 'winery-1' },
      data: { plan: WineryPlan.STANDARD, commissionRate: null },
    });
  });
});
