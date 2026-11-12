import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db', () => {
  const table = () => ({ findMany: vi.fn(), deleteMany: vi.fn() });
  return {
    db: {
      emailLog: table(),
      rateLimit: table(),
      session: table(),
      verification: table(),
      scheduledJob: table(),
    },
  };
});

vi.mock('@/lib/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const {
  purgeExpiredData,
  EMAIL_LOG_RETENTION_DAYS,
  EMAIL_LOG_LONG_RETENTION_DAYS,
  SCHEDULED_JOB_RETENTION_DAYS,
} = await import('@/server/services/retention.service');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2027-06-15T03:30:00.000Z');

const tables = [
  db.emailLog,
  db.rateLimit,
  db.session,
  db.verification,
  db.scheduledJob,
] as const;

function ids(count: number, prefix = 'row') {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of tables) {
    vi.mocked(table.findMany).mockResolvedValue([] as never);
    vi.mocked(table.deleteMany).mockImplementation((async (args: {
      where: { id: { in: string[] } };
    }) => ({ count: args.where.id.in.length })) as never);
  }
});

describe('purgeExpiredData', () => {
  it('applies the retention rule of each table', async () => {
    await purgeExpiredData({ now: NOW });

    // email_logs: sent/skipped (non statistic types) at 180 d, the rest at 365 d.
    expect(vi.mocked(db.emailLog.findMany).mock.calls[0]?.[0]?.where).toEqual({
      OR: [
        {
          status: { in: ['sent', 'skipped'] },
          type: { notIn: ['tasting_recap'] },
          createdAt: {
            lt: new Date(NOW.getTime() - EMAIL_LOG_RETENTION_DAYS * DAY),
          },
        },
        {
          createdAt: {
            lt: new Date(NOW.getTime() - EMAIL_LOG_LONG_RETENTION_DAYS * DAY),
          },
        },
      ],
    });
    // rate_limits: BigInt epoch ms, 24 h.
    expect(vi.mocked(db.rateLimit.findMany).mock.calls[0]?.[0]?.where).toEqual({
      lastRequest: { lt: BigInt(NOW.getTime() - DAY) },
    });
    // sessions / verifications: expired for more than a day.
    const authCutoff = new Date(NOW.getTime() - DAY);
    expect(vi.mocked(db.session.findMany).mock.calls[0]?.[0]?.where).toEqual({
      expiresAt: { lt: authCutoff },
    });
    expect(
      vi.mocked(db.verification.findMany).mock.calls[0]?.[0]?.where
    ).toEqual({ expiresAt: { lt: authCutoff } });
    // scheduled_jobs: DONE only.
    expect(
      vi.mocked(db.scheduledJob.findMany).mock.calls[0]?.[0]?.where
    ).toEqual({
      status: 'DONE',
      updatedAt: {
        lt: new Date(NOW.getTime() - SCHEDULED_JOB_RETENTION_DAYS * DAY),
      },
    });
  });

  it('never deletes without an id list (no unbounded delete)', async () => {
    vi.mocked(db.session.findMany).mockResolvedValueOnce(ids(2) as never);

    await purgeExpiredData({ now: NOW });

    for (const table of tables) {
      for (const [args] of vi.mocked(table.deleteMany).mock.calls) {
        expect(Array.isArray(args?.where?.id?.in)).toBe(true);
      }
    }
    expect(db.emailLog.deleteMany).not.toHaveBeenCalled();
    // A DONE job is re-checked as DONE at delete time.
    vi.mocked(db.scheduledJob.findMany).mockResolvedValueOnce(ids(1) as never);
    await purgeExpiredData({ now: NOW });
    expect(db.scheduledJob.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['row-0'] }, status: 'DONE' },
    });
  });

  it('loops batch by batch until a table is drained', async () => {
    vi.mocked(db.emailLog.findMany)
      .mockResolvedValueOnce(ids(3, 'a') as never)
      .mockResolvedValueOnce(ids(3, 'b') as never)
      .mockResolvedValueOnce(ids(1, 'c') as never);

    const stats = await purgeExpiredData({ now: NOW, batchSize: 3 });

    expect(db.emailLog.findMany).toHaveBeenCalledTimes(3);
    expect(
      vi
        .mocked(db.emailLog.findMany)
        .mock.calls.every(([args]) => args?.take === 3)
    ).toBe(true);
    expect(db.emailLog.deleteMany).toHaveBeenCalledTimes(3);
    expect(stats).toMatchObject({ emailLogs: 7, timedOut: false });
  });

  it('stops at the time budget and reports it (the next run resumes)', async () => {
    // Every batch is full → without a budget the loop would never end.
    vi.mocked(db.rateLimit.findMany).mockResolvedValue(ids(2) as never);
    let tick = 0;
    const clock = () => {
      tick += 100;
      return tick;
    };

    const stats = await purgeExpiredData({
      now: NOW,
      batchSize: 2,
      timeBudgetMs: 450,
      clock,
    });

    expect(stats.timedOut).toBe(true);
    expect(stats.rateLimits).toBeGreaterThan(0);
    // Later tables were not started.
    expect(db.emailLog.findMany).not.toHaveBeenCalled();
    expect(db.session.findMany).not.toHaveBeenCalled();
  });
});
