import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { auth } = await import('@/server/auth');
const { logInfo } = await import('@/lib/logger');
const { setWineryNoShowPolicy } =
  await import('@/server/actions/winery-policy');

const OWNER = { user: { id: 'user-1' } } as never;

describe('setWineryNoShowPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated calls', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const result = await setWineryNoShowPolicy({
      wineryId: 'w1',
      enabled: true,
      feeCents: 1500,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('UNAUTHORIZED');
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('rejects a fee above 50 CHF (validation)', async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    const result = await setWineryNoShowPolicy({
      wineryId: 'w1',
      enabled: true,
      feeCents: 9999,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('rejects a non-owner', async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'w1',
      slug: 'cave',
      userId: 'someone-else',
    } as never);
    const result = await setWineryNoShowPolicy({
      wineryId: 'w1',
      enabled: true,
      feeCents: 1500,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
    expect(db.winery.update).not.toHaveBeenCalled();
  });

  it('updates the policy, logs and invalidates caches', async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'w1',
      slug: 'cave',
      userId: 'user-1',
    } as never);
    vi.mocked(db.winery.update).mockResolvedValue({
      noShowFeeEnabled: true,
      noShowFeeCents: 2000,
    } as never);

    const result = await setWineryNoShowPolicy({
      wineryId: 'w1',
      enabled: true,
      feeCents: 2000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ enabled: true, feeCents: 2000 });
    }
    expect(db.winery.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { noShowFeeEnabled: true, noShowFeeCents: 2000 },
      select: { noShowFeeEnabled: true, noShowFeeCents: true },
    });
    expect(logInfo).toHaveBeenCalledWith(
      'winery-policy.no-show.updated',
      expect.objectContaining({ wineryId: 'w1', feeCents: 2000 })
    );
  });
});
