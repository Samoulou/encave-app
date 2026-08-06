import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db', () => ({
  db: {
    scheduledJob: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { runDueJobs } = await import('@/server/services/scheduled-jobs.service');

const job = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'job-1',
  type: 'TASTING_RECAP',
  payload: { bookingId: 'booking-1' },
  attempts: 0,
  ...overrides,
});

describe('runDueJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.scheduledJob.updateMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(db.scheduledJob.update).mockResolvedValue({} as never);
  });

  it('never queries when no type is enabled (flag OFF = true no-op)', async () => {
    const stats = await runDueJobs({ enabledTypes: [], handlers: {} });
    expect(stats).toEqual({
      claimed: 0,
      done: 0,
      cancelled: 0,
      retried: 0,
      failed: 0,
    });
    expect(db.scheduledJob.findMany).not.toHaveBeenCalled();
  });

  it('only claims due jobs of enabled types', async () => {
    vi.mocked(db.scheduledJob.findMany).mockResolvedValue([] as never);
    await runDueJobs({
      enabledTypes: ['TASTING_RECAP'],
      handlers: { TASTING_RECAP: async () => ({ ok: true }) },
    });
    expect(db.scheduledJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
          type: { in: ['TASTING_RECAP'] },
        }),
      })
    );
  });

  it('marks a successful job DONE', async () => {
    vi.mocked(db.scheduledJob.findMany).mockResolvedValue([job()] as never);
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const stats = await runDueJobs({
      enabledTypes: ['TASTING_RECAP'],
      handlers: { TASTING_RECAP: handler },
    });
    expect(stats).toMatchObject({ claimed: 1, done: 1 });
    expect(handler).toHaveBeenCalledWith(
      { bookingId: 'booking-1' },
      expect.objectContaining({ id: 'job-1', attempts: 1 })
    );
    expect(db.scheduledJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'DONE', lastError: null },
    });
  });

  it('parks a business skip as CANCELLED (never retried)', async () => {
    vi.mocked(db.scheduledJob.findMany).mockResolvedValue([job()] as never);
    const stats = await runDueJobs({
      enabledTypes: ['TASTING_RECAP'],
      handlers: {
        TASTING_RECAP: async () => ({ ok: false, skipReason: 'opted_out' }),
      },
    });
    expect(stats).toMatchObject({ claimed: 1, cancelled: 1 });
    expect(db.scheduledJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'CANCELLED', lastError: 'opted_out' },
    });
  });

  it('puts a throwing job back to PENDING before max attempts', async () => {
    vi.mocked(db.scheduledJob.findMany).mockResolvedValue([job()] as never);
    const stats = await runDueJobs({
      enabledTypes: ['TASTING_RECAP'],
      handlers: {
        TASTING_RECAP: async () => {
          throw new Error('send_failed');
        },
      },
    });
    expect(stats).toMatchObject({ claimed: 1, retried: 1, failed: 0 });
    expect(db.scheduledJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'PENDING', lastError: 'send_failed' },
    });
  });

  it('fails permanently at max attempts', async () => {
    vi.mocked(db.scheduledJob.findMany).mockResolvedValue([
      job({ attempts: 4 }),
    ] as never);
    const stats = await runDueJobs({
      enabledTypes: ['TASTING_RECAP'],
      handlers: {
        TASTING_RECAP: async () => {
          throw new Error('still failing');
        },
      },
    });
    expect(stats).toMatchObject({ claimed: 1, failed: 1, retried: 0 });
    expect(db.scheduledJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'FAILED', lastError: 'still failing' },
    });
  });

  it('skips a job whose claim was lost to a concurrent run', async () => {
    vi.mocked(db.scheduledJob.findMany).mockResolvedValue([job()] as never);
    vi.mocked(db.scheduledJob.updateMany).mockResolvedValue({
      count: 0,
    } as never);
    const handler = vi.fn();
    const stats = await runDueJobs({
      enabledTypes: ['TASTING_RECAP'],
      handlers: { TASTING_RECAP: handler },
    });
    expect(stats).toMatchObject({ claimed: 0 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('parks a job with no registered handler as FAILED', async () => {
    vi.mocked(db.scheduledJob.findMany).mockResolvedValue([
      job({ type: 'GIFT_CARD_DELIVERY' }),
    ] as never);
    const stats = await runDueJobs({
      enabledTypes: ['GIFT_CARD_DELIVERY'],
      handlers: {},
    });
    expect(stats).toMatchObject({ claimed: 1, failed: 1 });
  });
});
