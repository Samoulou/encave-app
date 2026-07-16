import * as Sentry from '@sentry/nextjs';
import { Prisma, ScheduledJobStatus } from '@prisma/client';
import { db } from '@/server/db';
import { logError, logInfo } from '@/lib/logger';
import { SCHEDULED_JOB_MAX_ATTEMPTS } from '@/lib/constants/wine';

/**
 * Generic ScheduledJob runner (P-07 / decision A2) — the first consumer
 * of the scheduled_jobs table, shared with the future GIFT_CARD_DELIVERY
 * (P-09) and REQUEST_OFFER_REMINDER (P-10) types.
 *
 * Contract per job:
 * - handler resolves { ok: true }            → DONE
 * - handler resolves { ok: false, skipReason } → CANCELLED (business skip,
 *   never retried — e.g. opt-out, cleared sheet, cancelled booking)
 * - handler throws                            → PENDING again (retried on
 *   the next cron pass) until SCHEDULED_JOB_MAX_ATTEMPTS, then FAILED.
 *
 * Flag gating happens OUTSIDE, via `enabledTypes`: a disabled type is
 * never claimed, so its jobs keep status PENDING and attempts 0 —
 * re-enabling the flag resumes them untouched.
 */

export type ScheduledJobHandlerResult =
  | { ok: true; note?: string }
  | { ok: false; skipReason: string };

export type ScheduledJobHandler = (
  _payload: Prisma.JsonValue,
  _job: { id: string; type: string; attempts: number }
) => Promise<ScheduledJobHandlerResult>;

export interface RunDueJobsStats {
  claimed: number;
  done: number;
  cancelled: number;
  retried: number;
  failed: number;
}

const RUN_BATCH_SIZE = 5;

/**
 * A job stuck in PROCESSING longer than this was orphaned by a crashed
 * or timed-out run (maxDuration cutoff, deploy, OOM) — normal events on
 * serverless. Reclaimed on the next pass instead of being lost forever.
 */
const STALE_PROCESSING_MINUTES = 30;

export async function runDueJobs(options: {
  enabledTypes: string[];
  handlers: Record<string, ScheduledJobHandler>;
  now?: Date;
  take?: number;
}): Promise<RunDueJobsStats> {
  const { enabledTypes, handlers, now = new Date(), take = 50 } = options;
  const stats: RunDueJobsStats = {
    claimed: 0,
    done: 0,
    cancelled: 0,
    retried: 0,
    failed: 0,
  };
  if (enabledTypes.length === 0) return stats;

  // Crash-safety sweep: requeue jobs orphaned mid-claim by a dead run.
  // The claim already incremented attempts, so exhausted ones go FAILED.
  const staleBefore = new Date(
    now.getTime() - STALE_PROCESSING_MINUTES * 60 * 1000
  );
  const staleWhere = {
    status: ScheduledJobStatus.PROCESSING,
    type: { in: enabledTypes },
    updatedAt: { lt: staleBefore },
  };
  const [requeued, exhausted] = await Promise.all([
    db.scheduledJob.updateMany({
      where: { ...staleWhere, attempts: { lt: SCHEDULED_JOB_MAX_ATTEMPTS } },
      data: {
        status: ScheduledJobStatus.PENDING,
        lastError: 'reclaimed_stale_processing',
      },
    }),
    db.scheduledJob.updateMany({
      where: { ...staleWhere, attempts: { gte: SCHEDULED_JOB_MAX_ATTEMPTS } },
      data: {
        status: ScheduledJobStatus.FAILED,
        lastError: 'stale_processing_exhausted',
      },
    }),
  ]);
  if (requeued.count > 0 || exhausted.count > 0) {
    logInfo('scheduled jobs reclaimed from stale PROCESSING', {
      action: 'runDueJobs',
      requeued: requeued.count,
      failed: exhausted.count,
    });
  }

  const due = await db.scheduledJob.findMany({
    where: {
      status: ScheduledJobStatus.PENDING,
      runAt: { lte: now },
      type: { in: enabledTypes },
      attempts: { lt: SCHEDULED_JOB_MAX_ATTEMPTS },
    },
    orderBy: { runAt: 'asc' },
    take,
    select: { id: true, type: true, payload: true, attempts: true },
  });

  for (let i = 0; i < due.length; i += RUN_BATCH_SIZE) {
    const batch = due.slice(i, i + RUN_BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (job) => {
        // Atomic claim: count === 1 means this run owns the job — two
        // concurrent cron passes can never process the same job.
        const claimed = await db.scheduledJob.updateMany({
          where: { id: job.id, status: ScheduledJobStatus.PENDING },
          data: {
            status: ScheduledJobStatus.PROCESSING,
            attempts: { increment: 1 },
          },
        });
        if (claimed.count !== 1) return;
        stats.claimed++;
        const attempt = job.attempts + 1;

        const handler = handlers[job.type];
        if (!handler) {
          // enabledTypes/handlers mismatch — configuration bug, park it.
          await db.scheduledJob.update({
            where: { id: job.id },
            data: {
              status: ScheduledJobStatus.FAILED,
              lastError: `no handler for type ${job.type}`,
            },
          });
          stats.failed++;
          logError('scheduled job without handler', undefined, {
            action: 'runDueJobs',
            jobId: job.id,
            type: job.type,
          });
          return;
        }

        try {
          const result = await handler(job.payload, {
            id: job.id,
            type: job.type,
            attempts: attempt,
          });
          if (result.ok) {
            await db.scheduledJob.update({
              where: { id: job.id },
              data: { status: ScheduledJobStatus.DONE, lastError: null },
            });
            stats.done++;
          } else {
            await db.scheduledJob.update({
              where: { id: job.id },
              data: {
                status: ScheduledJobStatus.CANCELLED,
                lastError: result.skipReason,
              },
            });
            stats.cancelled++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown';
          const exhausted = attempt >= SCHEDULED_JOB_MAX_ATTEMPTS;
          await db.scheduledJob.update({
            where: { id: job.id },
            data: {
              status: exhausted
                ? ScheduledJobStatus.FAILED
                : ScheduledJobStatus.PENDING,
              lastError: message,
            },
          });
          if (exhausted) {
            stats.failed++;
            logError('scheduled job failed permanently', error, {
              action: 'runDueJobs',
              jobId: job.id,
              type: job.type,
              attempts: attempt,
            });
            // Terminal FAILED is invisible otherwise (P-16 review #120):
            // the cron returns 200 and its check-in stays green — e.g. a
            // GIFT_CARD_DELIVERY dying here is a paid gift never delivered.
            Sentry.captureException(error, {
              tags: { area: 'scheduled-jobs', jobType: job.type },
              extra: { jobId: job.id, attempts: attempt },
            });
          } else {
            stats.retried++;
            logInfo('scheduled job will retry', {
              action: 'runDueJobs',
              jobId: job.id,
              type: job.type,
              attempts: attempt,
              error: message,
            });
          }
        }
      })
    );
  }

  return stats;
}
