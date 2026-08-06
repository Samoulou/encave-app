import { cache } from 'react';
import { ScheduledJobStatus } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Admin OPS / observability reads (P-15 / L-160). These surface mutable
 * incident state (Stripe webhook health, failed emails/jobs) that was until
 * now written but never read by any admin surface.
 *
 * Request-level `cache()` only — deliberately NOT persistently cached and NOT
 * tagged with ADMIN_METRICS_CACHE_TAG: a 5-minute-stale "0 failures" defeats
 * the point of an incident panel. The reads are cheap indexed lookups.
 */

const STUCK_THRESHOLD_MS = 15 * 60 * 1000;
const INCIDENT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export interface WebhookHealth {
  /** ISO timestamp of the most recent Stripe event, or null if none. */
  lastEventAt: string | null;
  /** Events (of the last 100) in FAILED status. */
  failedCount: number;
  /** Events stuck in PROCESSING for more than 15 minutes. */
  stuckCount: number;
  /** Events successfully PROCESSED (of the last 100). */
  processedCount: number;
  /** Max processing lag (updatedAt − createdAt) over processed events, ms. */
  maxLagMs: number | null;
  /** Mean processing lag over processed events, ms. */
  avgLagMs: number | null;
}

/**
 * Health of the Stripe webhook pipeline over the last 100 events. Prisma
 * cannot diff two columns in an aggregate, so lag is computed in JS over a
 * bounded batch (indexed by [status, createdAt]).
 */
export const getWebhookHealth = cache(async (): Promise<WebhookHealth> => {
  const now = Date.now();
  const events = await db.stripeEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { status: true, createdAt: true, updatedAt: true },
  });

  let failedCount = 0;
  let stuckCount = 0;
  let processedCount = 0;
  let maxLagMs: number | null = null;
  let lagSum = 0;

  for (const event of events) {
    if (event.status === 'FAILED') {
      failedCount++;
    } else if (event.status === 'PROCESSING') {
      // updatedAt, not createdAt (P-16 review, same fix as /api/health):
      // a FAILED event Stripe redelivers flips its ORIGINAL row back to
      // PROCESSING — its creation time would flag every retry of an event
      // older than 15 min as stuck the instant it restarts.
      if (now - event.updatedAt.getTime() > STUCK_THRESHOLD_MS) {
        stuckCount++;
      }
    } else if (event.status === 'PROCESSED') {
      processedCount++;
      const lag = event.updatedAt.getTime() - event.createdAt.getTime();
      lagSum += lag;
      maxLagMs = maxLagMs === null ? lag : Math.max(maxLagMs, lag);
    }
  }

  const first = events[0];
  return {
    lastEventAt: first ? first.createdAt.toISOString() : null,
    failedCount,
    stuckCount,
    processedCount,
    maxLagMs,
    avgLagMs: processedCount > 0 ? Math.round(lagSum / processedCount) : null,
  };
});

export interface IncidentEmail {
  id: string;
  type: string;
  createdAt: string;
  errorMessage: string | null;
}

export interface IncidentJob {
  id: string;
  type: string;
  runAt: string;
  attempts: number;
  lastError: string | null;
}

export interface RecentIncidents {
  failedEmails: IncidentEmail[];
  /** Total failed emails in the last 24h (the list is capped at 10). */
  failedEmails24h: number;
  failedJobs: IncidentJob[];
}

/**
 * Latest failed emails and scheduled jobs for the admin incident panel.
 */
export const getRecentIncidents = cache(async (): Promise<RecentIncidents> => {
  const since = new Date(Date.now() - INCIDENT_LOOKBACK_MS);

  const [failedEmails, failedEmails24h, failedJobs] = await Promise.all([
    db.emailLog.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, type: true, createdAt: true, errorMessage: true },
    }),
    db.emailLog.count({
      where: { status: 'failed', createdAt: { gte: since } },
    }),
    db.scheduledJob.findMany({
      where: { status: ScheduledJobStatus.FAILED },
      orderBy: { runAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        runAt: true,
        attempts: true,
        lastError: true,
      },
    }),
  ]);

  return {
    failedEmails: failedEmails.map((email) => ({
      id: email.id,
      type: email.type,
      createdAt: email.createdAt.toISOString(),
      errorMessage: email.errorMessage,
    })),
    failedEmails24h,
    failedJobs: failedJobs.map((job) => ({
      id: job.id,
      type: job.type,
      runAt: job.runAt.toISOString(),
      attempts: job.attempts,
      lastError: job.lastError,
    })),
  };
});
