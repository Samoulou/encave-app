import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

const txMock = {
  bookingWine: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  scheduledJob: {
    updateMany: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/server/db', () => ({
  db: {
    experience: {
      findFirst: vi.fn(),
    },
    wine: {
      count: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
      await callback(txMock);
    }),
  },
}));

vi.mock('@/server/queries/feature-flags.queries', () => ({
  isFlagEnabled: vi.fn(),
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
const { saveTastingSheet } = await import('@/server/actions/tasting-sheet');

const session: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: 'FR',
  },
};

const CUID_A = 'cjld2cjxh0000qzrmn831i7rn';
const CUID_B = 'cjld2cyuq0000t3rmniod1foy';

const validInput = {
  experienceId: CUID_A,
  date: '2026-07-08',
  timeSlot: '10:00',
  wineIds: [CUID_B],
};

const experience = { id: CUID_A, duration: 90, wineryId: 'winery-1' };

describe('saveTastingSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(isFlagEnabled).mockResolvedValue(true);
    vi.mocked(db.experience.findFirst).mockResolvedValue(experience as never);
    vi.mocked(db.wine.count).mockResolvedValue(1);
    txMock.scheduledJob.findMany.mockResolvedValue([]);
  });

  it('rejects unauthenticated callers', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await saveTastingSheet(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('is FORBIDDEN when the TASTING_SHEET flag is off', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const result = await saveTastingSheet(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an impossible date (2026-02-31)', async () => {
    const result = await saveTastingSheet({
      ...validInput,
      date: '2026-02-31',
    });
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it("is NOT_FOUND for another owner's experience", async () => {
    vi.mocked(db.experience.findFirst).mockResolvedValue(null);
    const result = await saveTastingSheet(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it("rejects wines that don't belong to the winery", async () => {
    vi.mocked(db.wine.count).mockResolvedValue(0);
    const result = await saveTastingSheet(validInput);
    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('fans out to active bookings and arms one job per booking', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      { id: 'booking-1' },
      { id: 'booking-2' },
    ] as never);

    const result = await saveTastingSheet(validInput);
    expect(result).toMatchObject({
      success: true,
      data: { bookingCount: 2, wineCount: 1 },
    });
    if (!result.success) throw new Error('unreachable');
    expect(result.data.recapRunAt).toBeInstanceOf(Date);

    // Fan-out: one sync per booking.
    expect(txMock.bookingWine.deleteMany).toHaveBeenCalledTimes(2);
    expect(txMock.bookingWine.createMany).toHaveBeenCalledTimes(2);
    expect(txMock.bookingWine.createMany).toHaveBeenCalledWith({
      data: [{ bookingId: 'booking-1', wineId: CUID_B }],
      skipDuplicates: true,
    });

    // One TASTING_RECAP job per booking, dedupeKey'd.
    expect(txMock.scheduledJob.create).toHaveBeenCalledTimes(2);
    expect(txMock.scheduledJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'TASTING_RECAP',
        dedupeKey: 'TASTING_RECAP:booking-1',
        payload: { bookingId: 'booking-1' },
      }),
    });
  });

  it('schedules a session filled late (> J+2) for immediate delivery', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      { id: 'booking-1' },
    ] as never);

    // Session on 2026-07-08 10:00 ended long before "now" + 48h.
    const before = Date.now();
    const result = await saveTastingSheet(validInput);
    if (!result.success || result.data.recapRunAt === null) {
      throw new Error('expected an armed recap');
    }
    expect(result.data.recapRunAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.data.recapRunAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 1000
    );
  });

  it('clearing the sheet cancels pending jobs and purges wines', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      { id: 'booking-1' },
    ] as never);

    const result = await saveTastingSheet({ ...validInput, wineIds: [] });
    expect(result).toMatchObject({
      success: true,
      data: { bookingCount: 1, wineCount: 0, recapRunAt: null },
    });
    expect(txMock.bookingWine.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', wineId: { notIn: [] } },
    });
    expect(txMock.bookingWine.createMany).not.toHaveBeenCalled();
    expect(txMock.scheduledJob.updateMany).toHaveBeenCalledWith({
      where: {
        dedupeKey: { in: ['TASTING_RECAP:booking-1'] },
        status: 'PENDING',
      },
      data: { status: 'CANCELLED', lastError: 'tasting_sheet_cleared' },
    });
  });

  it('re-arms a CANCELLED job when the sheet is re-filled', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      { id: 'booking-1' },
    ] as never);
    txMock.scheduledJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        dedupeKey: 'TASTING_RECAP:booking-1',
        status: 'CANCELLED',
      },
    ] as never);

    const result = await saveTastingSheet(validInput);
    expect(result).toMatchObject({ success: true });
    expect(txMock.scheduledJob.create).not.toHaveBeenCalled();
    expect(txMock.scheduledJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'PENDING',
        attempts: 0,
        lastError: null,
      }),
    });
  });

  it('never touches a DONE job (recap already sent)', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      { id: 'booking-1' },
    ] as never);
    txMock.scheduledJob.findMany.mockResolvedValue([
      { id: 'job-1', dedupeKey: 'TASTING_RECAP:booking-1', status: 'DONE' },
    ] as never);

    const result = await saveTastingSheet(validInput);
    expect(result).toMatchObject({ success: true });
    expect(txMock.scheduledJob.create).not.toHaveBeenCalled();
    expect(txMock.scheduledJob.update).not.toHaveBeenCalled();
  });
});
