import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    featureFlag: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

const { db } = await import('@/server/db');
const { auth } = await import('@/server/auth');
const { revalidateTag } = await import('next/cache');
const { setFeatureFlag } = await import('@/server/actions/featureFlags');

describe('setFeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated calls', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await setFeatureFlag('BOOKING_FEE', true);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
    expect(db.featureFlag.upsert).not.toHaveBeenCalled();
  });

  it('rejects non-admin users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', role: UserRole.WINEMAKER },
    } as never);

    const result = await setFeatureFlag('BOOKING_FEE', true);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
    expect(db.featureFlag.upsert).not.toHaveBeenCalled();
  });

  it('rejects unknown flag keys', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', role: UserRole.ADMIN },
    } as never);

    const result = await setFeatureFlag('NOT_A_FLAG', true);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(db.featureFlag.upsert).not.toHaveBeenCalled();
  });

  it('upserts the flag and revalidates the cache tag (kill-switch)', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', role: UserRole.ADMIN },
    } as never);
    vi.mocked(db.featureFlag.upsert).mockResolvedValue({
      key: 'BOOKING_FEE',
      enabled: true,
      updatedAt: new Date(),
    } as never);

    const result = await setFeatureFlag('BOOKING_FEE', true);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ key: 'BOOKING_FEE', enabled: true });
    }
    expect(db.featureFlag.upsert).toHaveBeenCalledWith({
      where: { key: 'BOOKING_FEE' },
      update: { enabled: true },
      create: { key: 'BOOKING_FEE', enabled: true },
    });
    // The revalidation IS the kill-switch: effective without a deploy.
    expect(revalidateTag).toHaveBeenCalledWith('feature-flags');
  });
});
