import { ScheduledJobStatus } from '@prisma/client';
import { subDays } from 'date-fns';
import { db } from '@/server/db';
import { logInfo } from '@/lib/logger';

/**
 * Data retention purge (quality lot, audit A10).
 *
 * Five technical tables grew without bound: one `email_logs` row per email
 * AND per skipped send (≈ one per idle winery per day), one `rate_limits`
 * row per (IP, auth path) ever seen, expired `sessions` and `verifications`
 * never reaped by better-auth, and every finished `scheduled_jobs` row.
 * None of it is business data — bookings, gift ledger, requests and admin
 * actions are deliberately out of scope.
 *
 * Internal service — no 'use server', no auth(): called by the
 * `/api/cron/purge-retention` route only.
 *
 * Deletes run in bounded batches (ids first, then `deleteMany` on those
 * ids) so no statement holds a long lock or a huge transaction on the
 * pooled Neon connection, and the whole run stops at a time budget — what
 * is left is picked up by the next daily run.
 */

/** Informational logs (delivered or deliberately skipped sends). */
export const EMAIL_LOG_RETENTION_DAYS = 180;
/**
 * Everything else in `email_logs`: failures (kept for support and
 * deliverability forensics) and the types that back a winemaker-facing
 * statistic.
 */
export const EMAIL_LOG_LONG_RETENTION_DAYS = 365;
/**
 * Email types whose rows feed a product figure and therefore follow the
 * LONG retention even when `sent`: the tasting-recap open/click rates shown
 * to the winery (`getTastingEmailStats`) are counted from these rows.
 */
export const EMAIL_LOG_LONG_RETENTION_TYPES: readonly string[] = [
  'tasting_recap',
];
/** Statuses that are purely informational. */
const EMAIL_LOG_SHORT_RETENTION_STATUSES = ['sent', 'skipped'];

/**
 * A `rate_limits` row is dead once its window has elapsed. The longest
 * configured window is 1 h (sign-up) — 24 h leaves a wide margin.
 */
export const RATE_LIMIT_RETENTION_HOURS = 24;
/** Grace after `expiresAt` before a session / verification row is reaped. */
export const EXPIRED_AUTH_ROW_GRACE_DAYS = 1;
/** Finished (DONE) deferred jobs — their effect is recorded elsewhere. */
export const SCHEDULED_JOB_RETENTION_DAYS = 90;

const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_TIME_BUDGET_MS = 240_000;

export interface RetentionPurgeStats {
  emailLogs: number;
  rateLimits: number;
  sessions: number;
  verifications: number;
  scheduledJobs: number;
  /** True when the time budget stopped the run before every table was drained. */
  timedOut: boolean;
  durationMs: number;
}

export interface RetentionPurgeOptions {
  now?: Date;
  batchSize?: number;
  timeBudgetMs?: number;
  /** Monotonic clock, injectable for tests. */
  clock?: () => number;
}

type IdRow = { id: string };

interface PurgeTarget {
  /** Up to `take` ids of rows past their retention. */
  findBatch: (_take: number) => Promise<IdRow[]>;
  deleteBatch: (_ids: string[]) => Promise<{ count: number }>;
}

/**
 * Drain one table batch by batch until it is empty or the deadline passes.
 * Returns the number of rows deleted and whether rows may remain.
 */
async function drain(
  target: PurgeTarget,
  batchSize: number,
  isPastDeadline: () => boolean
): Promise<{ deleted: number; interrupted: boolean }> {
  let deleted = 0;
  for (;;) {
    if (isPastDeadline()) return { deleted, interrupted: true };
    const rows = await target.findBatch(batchSize);
    if (rows.length === 0) return { deleted, interrupted: false };
    const { count } = await target.deleteBatch(rows.map((row) => row.id));
    deleted += count;
    if (rows.length < batchSize) return { deleted, interrupted: false };
  }
}

export async function purgeExpiredData(
  options: RetentionPurgeOptions = {}
): Promise<RetentionPurgeStats> {
  const now = options.now ?? new Date();
  const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE);
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const clock = options.clock ?? Date.now;
  const startedAt = clock();
  const isPastDeadline = () => clock() - startedAt >= timeBudgetMs;

  const emailShortCutoff = subDays(now, EMAIL_LOG_RETENTION_DAYS);
  const emailLongCutoff = subDays(now, EMAIL_LOG_LONG_RETENTION_DAYS);
  const rateLimitCutoffMs = BigInt(
    now.getTime() - RATE_LIMIT_RETENTION_HOURS * 60 * 60 * 1000
  );
  const authCutoff = subDays(now, EXPIRED_AUTH_ROW_GRACE_DAYS);
  const jobCutoff = subDays(now, SCHEDULED_JOB_RETENTION_DAYS);

  const emailLogWhere = {
    OR: [
      // Informational rows past the short retention…
      {
        status: { in: EMAIL_LOG_SHORT_RETENTION_STATUSES },
        type: { notIn: [...EMAIL_LOG_LONG_RETENTION_TYPES] },
        createdAt: { lt: emailShortCutoff },
      },
      // …and every row (failures, statistic-backing types) past the long one.
      { createdAt: { lt: emailLongCutoff } },
    ],
  };

  // Ordered cheapest/most-volatile first; each entry is drained in turn.
  const targets: Array<
    [keyof Omit<RetentionPurgeStats, 'timedOut' | 'durationMs'>, PurgeTarget]
  > = [
    [
      'rateLimits',
      {
        findBatch: (take) =>
          db.rateLimit.findMany({
            where: { lastRequest: { lt: rateLimitCutoffMs } },
            select: { id: true },
            take,
          }),
        deleteBatch: (ids) =>
          db.rateLimit.deleteMany({ where: { id: { in: ids } } }),
      },
    ],
    [
      'verifications',
      {
        findBatch: (take) =>
          db.verification.findMany({
            where: { expiresAt: { lt: authCutoff } },
            select: { id: true },
            take,
          }),
        deleteBatch: (ids) =>
          db.verification.deleteMany({ where: { id: { in: ids } } }),
      },
    ],
    [
      'sessions',
      {
        findBatch: (take) =>
          db.session.findMany({
            where: { expiresAt: { lt: authCutoff } },
            select: { id: true },
            take,
          }),
        deleteBatch: (ids) =>
          db.session.deleteMany({ where: { id: { in: ids } } }),
      },
    ],
    [
      'scheduledJobs',
      {
        findBatch: (take) =>
          db.scheduledJob.findMany({
            where: {
              status: ScheduledJobStatus.DONE,
              updatedAt: { lt: jobCutoff },
            },
            select: { id: true },
            take,
          }),
        // The status guard is repeated on the delete: a job is never
        // removed in any state but DONE, whatever happened in between.
        deleteBatch: (ids) =>
          db.scheduledJob.deleteMany({
            where: { id: { in: ids }, status: ScheduledJobStatus.DONE },
          }),
      },
    ],
    [
      'emailLogs',
      {
        findBatch: (take) =>
          db.emailLog.findMany({
            where: emailLogWhere,
            select: { id: true },
            take,
          }),
        deleteBatch: (ids) =>
          db.emailLog.deleteMany({ where: { id: { in: ids } } }),
      },
    ],
  ];

  const stats: RetentionPurgeStats = {
    emailLogs: 0,
    rateLimits: 0,
    sessions: 0,
    verifications: 0,
    scheduledJobs: 0,
    timedOut: false,
    durationMs: 0,
  };

  for (const [key, target] of targets) {
    const { deleted, interrupted } = await drain(
      target,
      batchSize,
      isPastDeadline
    );
    stats[key] = deleted;
    if (interrupted) {
      stats.timedOut = true;
      break;
    }
  }

  stats.durationMs = clock() - startedAt;
  logInfo('retention.purged', { action: 'purgeExpiredData', ...stats });
  return stats;
}
