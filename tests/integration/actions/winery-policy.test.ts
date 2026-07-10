import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancellationPolicy } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
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
const { setWineryCancellationPolicy } =
  await import('@/server/actions/winery-policy');

const ownerSession = {
  user: { id: 'user-1' },
} as never;

describe('setWineryCancellationPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated calls', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await setWineryCancellationPolicy({
      wineryId: 'winery-1',
      policy: CancellationPolicy.FLEXIBLE,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
    expect(db.winery.findUnique).not.toHaveBeenCalled();
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown policy value', async () => {
    vi.mocked(auth).mockResolvedValue(ownerSession);

    const result = await setWineryCancellationPolicy({
      wineryId: 'winery-1',
      policy: 'WHENEVER_I_WANT',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(db.winery.findUnique).not.toHaveBeenCalled();
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('rejects a missing wineryId', async () => {
    vi.mocked(auth).mockResolvedValue(ownerSession);

    const result = await setWineryCancellationPolicy({
      wineryId: '',
      policy: CancellationPolicy.STRICT,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the winery does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(ownerSession);
    vi.mocked(db.winery.findUnique).mockResolvedValue(null);

    const result = await setWineryCancellationPolicy({
      wineryId: 'missing',
      policy: CancellationPolicy.FLEXIBLE,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('rejects a user who does not own the winery', async () => {
    vi.mocked(auth).mockResolvedValue(ownerSession);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'winery-1',
      slug: 'cave-test',
      userId: 'someone-else',
    } as never);

    const result = await setWineryCancellationPolicy({
      wineryId: 'winery-1',
      policy: CancellationPolicy.FLEXIBLE,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
    expect(db.winery.update).not.toHaveBeenCalled();
    expect(logInfo).not.toHaveBeenCalled();
  });

  it('updates the policy, logs the change and invalidates caches', async () => {
    vi.mocked(auth).mockResolvedValue(ownerSession);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'winery-1',
      slug: 'cave-test',
      userId: 'user-1',
    } as never);
    vi.mocked(db.winery.update).mockResolvedValue({
      cancellationPolicy: CancellationPolicy.FLEXIBLE,
    } as never);

    const result = await setWineryCancellationPolicy({
      wineryId: 'winery-1',
      policy: CancellationPolicy.FLEXIBLE,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ policy: CancellationPolicy.FLEXIBLE });
    }
    expect(db.winery.update).toHaveBeenCalledWith({
      where: { id: 'winery-1' },
      data: { cancellationPolicy: CancellationPolicy.FLEXIBLE },
      select: { cancellationPolicy: true },
    });
    // Refund-impacting setting: mandatory audit log + cache invalidation
    expect(logInfo).toHaveBeenCalledWith('winery-policy.updated', {
      wineryId: 'winery-1',
      policy: CancellationPolicy.FLEXIBLE,
      userId: 'user-1',
    });
    expect(revalidateTag).toHaveBeenCalledWith('wineries');
    expect(revalidateTag).toHaveBeenCalledWith('experiences');
  });

  it('returns INTERNAL_ERROR when the update fails', async () => {
    vi.mocked(auth).mockResolvedValue(ownerSession);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'winery-1',
      slug: 'cave-test',
      userId: 'user-1',
    } as never);
    vi.mocked(db.winery.update).mockRejectedValue(new Error('db down'));

    const result = await setWineryCancellationPolicy({
      wineryId: 'winery-1',
      policy: CancellationPolicy.STANDARD,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
