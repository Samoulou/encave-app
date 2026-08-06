import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    winery: {
      findUnique: vi.fn(),
    },
    wine: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(),
}));

vi.mock('@/server/actions/winery-helpers', () => ({
  invalidateWineryCaches: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { isFlagEnabled } =
  await import('@/server/queries/feature-flags.queries');
const { invalidateWineryCaches } =
  await import('@/server/actions/winery-helpers');
const { createWine, updateWine, deleteWine } =
  await import('@/server/actions/wine');

const session: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: 'FR',
  },
};

const winery = { id: 'winery-1', slug: 'cave-test' };

const validWine = {
  name: 'Fendant Les Murettes',
  grapeVariety: 'Chasselas',
  vintage: 2024,
  price: 2450,
  available: true,
};

describe('createWine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
    vi.mocked(db.winery.findUnique).mockResolvedValue(winery as never);
  });

  it('rejects unauthenticated callers', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await createWine(validWine);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(db.wine.create).not.toHaveBeenCalled();
  });

  it('is FORBIDDEN when the TASTING_SHEET flag is off', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const result = await createWine(validWine);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(db.wine.create).not.toHaveBeenCalled();
  });

  it('rejects invalid input (negative price)', async () => {
    const result = await createWine({ ...validWine, price: -5 });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('rejects a vintage in the far future', async () => {
    const result = await createWine({
      ...validWine,
      vintage: new Date().getFullYear() + 2,
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('creates the wine for the owned winery and invalidates caches', async () => {
    vi.mocked(db.wine.create).mockResolvedValue({ id: 'wine-1' } as never);
    const result = await createWine(validWine);
    expect(result).toEqual({ success: true, data: { wineId: 'wine-1' } });
    expect(db.wine.create).toHaveBeenCalledWith({
      data: { ...validWine, wineryId: 'winery-1' },
      select: { id: true },
    });
    expect(invalidateWineryCaches).toHaveBeenCalledWith('cave-test');
  });
});

describe('updateWine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
    vi.mocked(db.winery.findUnique).mockResolvedValue(winery as never);
  });

  it('rejects unauthenticated callers', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await updateWine({
      wineId: 'c'.repeat(24),
      available: false,
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('rejects invalid input (bad wineId)', async () => {
    const result = await updateWine({ wineId: 'nope', available: false });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it("is NOT_FOUND for another winery's wine (tenant-scoped write)", async () => {
    vi.mocked(db.wine.updateMany).mockResolvedValue({ count: 0 } as never);
    const result = await updateWine({
      wineId: 'cjld2cjxh0000qzrmn831i7rn',
      available: false,
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('updates the availability toggle', async () => {
    vi.mocked(db.wine.updateMany).mockResolvedValue({ count: 1 } as never);
    const result = await updateWine({
      wineId: 'cjld2cjxh0000qzrmn831i7rn',
      available: false,
    });
    expect(result).toMatchObject({ success: true });
    expect(db.wine.updateMany).toHaveBeenCalledWith({
      where: { id: 'cjld2cjxh0000qzrmn831i7rn', wineryId: 'winery-1' },
      data: { available: false },
    });
    expect(invalidateWineryCaches).toHaveBeenCalledWith('cave-test');
  });
});

describe('deleteWine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
    vi.mocked(db.winery.findUnique).mockResolvedValue(winery as never);
  });

  it('rejects unauthenticated callers', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await deleteWine({ wineId: 'cjld2cjxh0000qzrmn831i7rn' });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('is NOT_FOUND when the wine belongs to another winery', async () => {
    vi.mocked(db.wine.findFirst).mockResolvedValue(null);
    const result = await deleteWine({ wineId: 'cjld2cjxh0000qzrmn831i7rn' });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(db.wine.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete a served wine (CONFLICT keeps tasting history)', async () => {
    vi.mocked(db.wine.findFirst).mockResolvedValue({
      id: 'wine-1',
      _count: { bookingWines: 3 },
    } as never);
    const result = await deleteWine({ wineId: 'cjld2cjxh0000qzrmn831i7rn' });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'CONFLICT' },
    });
    expect(db.wine.delete).not.toHaveBeenCalled();
  });

  it('deletes an unserved wine', async () => {
    vi.mocked(db.wine.findFirst).mockResolvedValue({
      id: 'wine-1',
      _count: { bookingWines: 0 },
    } as never);
    vi.mocked(db.wine.delete).mockResolvedValue({ id: 'wine-1' } as never);
    const result = await deleteWine({ wineId: 'cjld2cjxh0000qzrmn831i7rn' });
    expect(result).toEqual({ success: true, data: { wineId: 'wine-1' } });
    expect(invalidateWineryCaches).toHaveBeenCalledWith('cave-test');
  });
});
