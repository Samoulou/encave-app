/**
 * Quality lot (audit A10) — retention purge against a REAL migrated
 * database: the real cron route (real Bearer auth) and the real batched
 * deletes. Every fixture is tagged with a per-run marker and asserted by
 * id, so the suite is safe on a database shared with other suites.
 *
 * Run with:  INVARIANTS_DATABASE_URL=postgresql://... npm run test:db:invariants
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient, ScheduledJobStatus } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

if (url) {
  process.env.DATABASE_URL = url;
}

const CRON_SECRET = 'dbtest-cron-secret-0123456789abcdef';
process.env.CRON_SECRET = CRON_SECRET;
delete process.env.NEXT_PUBLIC_SENTRY_DSN;

const headerState = { current: new Headers() };
vi.mock('next/headers', () => ({
  headers: async () => headerState.current,
}));

type RetentionService = typeof import('@/server/services/retention.service');
type PurgeRoute = typeof import('@/app/api/cron/purge-retention/route');

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!url)('retention purge (A10)', () => {
  let db: PrismaClient;
  let purgeExpiredData: RetentionService['purgeExpiredData'];
  let GET: PurgeRoute['GET'];

  const run = `ret-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);
  let userId: string;

  // name → id, per table; `keep*` must survive, `purge*` must go.
  const emailLogs: Record<string, string> = {};
  const jobs: Record<string, string> = {};
  const sessions: Record<string, string> = {};
  const verifications: Record<string, string> = {};
  const rateLimits: Record<string, string> = {};

  async function emailLog(
    name: string,
    status: string,
    ageDays: number,
    type = 'reminder_24h'
  ) {
    const row = await db.emailLog.create({
      data: {
        type,
        status,
        recipientId: `${run}@test.encave.ch`,
        createdAt: daysAgo(ageDays),
      },
    });
    emailLogs[name] = row.id;
  }

  async function job(
    name: string,
    status: ScheduledJobStatus,
    ageDays: number
  ) {
    const row = await db.scheduledJob.create({
      data: {
        type: `RETENTION_TEST_${run}`,
        runAt: daysAgo(ageDays),
        status,
        payload: {},
      },
    });
    // `updatedAt` is @updatedAt — backdate it with SQL.
    await db.$executeRaw`UPDATE "scheduled_jobs" SET "updatedAt" = ${daysAgo(ageDays)} WHERE "id" = ${row.id}`;
    jobs[name] = row.id;
  }

  async function exists(
    model:
      | 'emailLog'
      | 'scheduledJob'
      | 'session'
      | 'verification'
      | 'rateLimit',
    id: string | undefined
  ): Promise<boolean> {
    if (!id) throw new Error('fixture id missing');
    const where = { where: { id }, select: { id: true } };
    switch (model) {
      case 'emailLog':
        return (await db.emailLog.findUnique(where)) !== null;
      case 'scheduledJob':
        return (await db.scheduledJob.findUnique(where)) !== null;
      case 'session':
        return (await db.session.findUnique(where)) !== null;
      case 'verification':
        return (await db.verification.findUnique(where)) !== null;
      case 'rateLimit':
        return (await db.rateLimit.findUnique(where)) !== null;
    }
  }

  beforeAll(async () => {
    ({ purgeExpiredData } =
      await import('@/server/services/retention.service'));
    ({ GET } = await import('@/app/api/cron/purge-retention/route'));
    db = new PrismaClient({ datasourceUrl: url });

    const user = await db.user.create({
      data: { email: `${run}@test.encave.ch`, role: 'CLIENT' },
    });
    userId = user.id;

    // email_logs — 180 d for sent/skipped, 365 d for everything else.
    await emailLog('purgeSentOld', 'sent', 181);
    await emailLog('purgeSkippedOld', 'skipped', 200);
    await emailLog('keepSentRecent', 'sent', 179);
    await emailLog('keepFailedMid', 'failed', 200);
    await emailLog('purgeFailedOld', 'failed', 366);
    // Statistic-backing type: follows the long retention even when sent.
    await emailLog('keepRecapMid', 'sent', 200, 'tasting_recap');
    await emailLog('purgeRecapOld', 'sent', 366, 'tasting_recap');

    // scheduled_jobs — only DONE, only past 90 d.
    await job('purgeDoneOld', ScheduledJobStatus.DONE, 91);
    await job('keepDoneRecent', ScheduledJobStatus.DONE, 89);
    await job('keepFailedOld', ScheduledJobStatus.FAILED, 400);
    await job('keepPendingOld', ScheduledJobStatus.PENDING, 400);
    await job('keepCancelledOld', ScheduledJobStatus.CANCELLED, 400);

    // sessions / verifications — expired for more than the 1-day grace.
    const session = async (name: string, expiresAt: Date) => {
      const row = await db.session.create({
        data: { token: `${run}-${name}`, userId, expiresAt },
      });
      sessions[name] = row.id;
    };
    await session('purgeExpired', daysAgo(2));
    await session('keepJustExpired', new Date(now.getTime() - 60 * 60 * 1000));
    await session('keepLive', new Date(now.getTime() + 30 * DAY));

    const verification = async (name: string, expiresAt: Date) => {
      const row = await db.verification.create({
        data: { identifier: `${run}-${name}`, value: '000000', expiresAt },
      });
      verifications[name] = row.id;
    };
    await verification('purgeExpired', daysAgo(3));
    await verification('keepLive', new Date(now.getTime() + 10 * 60 * 1000));

    // rate_limits — dead once the longest window (1 h) is long gone (24 h).
    const rateLimit = async (name: string, lastRequestMs: number) => {
      const row = await db.rateLimit.create({
        data: {
          key: `${run}-${name}`,
          count: 3,
          lastRequest: BigInt(lastRequestMs),
        },
      });
      rateLimits[name] = row.id;
    };
    await rateLimit('purgeStale', now.getTime() - 2 * DAY);
    await rateLimit('keepRecent', now.getTime() - 60 * 1000);
  });

  afterAll(async () => {
    await db.emailLog.deleteMany({
      where: { recipientId: `${run}@test.encave.ch` },
    });
    await db.scheduledJob.deleteMany({
      where: { type: `RETENTION_TEST_${run}` },
    });
    await db.verification.deleteMany({
      where: { identifier: { startsWith: run } },
    });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: run } } });
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it('the route refuses a request without the cron secret and deletes nothing', async () => {
    headerState.current = new Headers();
    const response = await GET();

    expect(response.status).toBe(401);
    expect(await exists('emailLog', emailLogs.purgeSentOld)).toBe(true);
    expect(await exists('session', sessions.purgeExpired)).toBe(true);
  });

  it('purges exactly the rows past their retention (tiny batches, several passes)', async () => {
    // batchSize 2 forces the multi-batch loop on real data.
    const stats = await purgeExpiredData({ now, batchSize: 2 });

    expect(stats.timedOut).toBe(false);
    expect(stats.emailLogs).toBeGreaterThanOrEqual(4);
    expect(stats.scheduledJobs).toBeGreaterThanOrEqual(1);
    expect(stats.sessions).toBeGreaterThanOrEqual(1);
    expect(stats.verifications).toBeGreaterThanOrEqual(1);
    expect(stats.rateLimits).toBeGreaterThanOrEqual(1);

    const state = async (
      model: Parameters<typeof exists>[0],
      rows: Record<string, string>
    ) =>
      Object.fromEntries(
        await Promise.all(
          Object.entries(rows).map(
            async ([name, id]) => [name, await exists(model, id)] as const
          )
        )
      );

    expect(await state('emailLog', emailLogs)).toEqual({
      purgeSentOld: false,
      purgeSkippedOld: false,
      keepSentRecent: true,
      keepFailedMid: true,
      purgeFailedOld: false,
      keepRecapMid: true,
      purgeRecapOld: false,
    });
    expect(await state('scheduledJob', jobs)).toEqual({
      purgeDoneOld: false,
      keepDoneRecent: true,
      keepFailedOld: true,
      keepPendingOld: true,
      keepCancelledOld: true,
    });
    expect(await state('session', sessions)).toEqual({
      purgeExpired: false,
      keepJustExpired: true,
      keepLive: true,
    });
    expect(await state('verification', verifications)).toEqual({
      purgeExpired: false,
      keepLive: true,
    });
    expect(await state('rateLimit', rateLimits)).toEqual({
      purgeStale: false,
      keepRecent: true,
    });
  });

  it('is idempotent through the authenticated route', async () => {
    headerState.current = new Headers({
      authorization: `Bearer ${CRON_SECRET}`,
    });
    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ timedOut: false });
    // Our fixtures were already purged: the survivors are untouched.
    expect(await exists('emailLog', emailLogs.keepFailedMid)).toBe(true);
    expect(await exists('scheduledJob', jobs.keepFailedOld)).toBe(true);
    expect(await exists('session', sessions.keepLive)).toBe(true);
  });
});
