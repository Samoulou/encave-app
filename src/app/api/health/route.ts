import { NextRequest, NextResponse } from 'next/server';
import { subHours, subMinutes } from 'date-fns';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import {
  checkRateLimit,
  getClientIp,
} from '@/server/services/rate-limit.service';
import { env } from '@/lib/env';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Health probe (P-16 / WS-E, L-184). Polled by an external uptime monitor
 * (1–3 min) — Vercel Hobby has no sub-daily cron, so lag/stuck detection
 * lives HERE, not in a cron. Contract:
 *  - 200 = nothing needs a human NOW; any other status → the monitor
 *    alerts. `checks` may still carry a 'warn' on 200 (see below).
 *  - `?deep=1` adds the paid/slow probes: Stripe API reachability, stuck
 *    or failed StripeEvents, recent ScheduledJob failures.
 *  - Response carries per-check verdicts only ('ok'|'fail'|'degraded'|
 *    'warn'|'skipped') — never error details or internals (public
 *    endpoint), and the route is rate limited per IP (CLAUDE.md rule —
 *    ?deep=1 costs a Stripe API read + several DB counts per hit).
 */

const PROBE_TIMEOUT_MS = 2000;
const STUCK_PROCESSING_MINUTES = 15;
const FAILED_LOOKBACK_HOURS = 1;
// Generous for a 1-min monitor (even two of them), hostile to a loop.
const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };

type CheckStatus = 'ok' | 'fail' | 'degraded' | 'warn' | 'skipped';

/**
 * Bounded probe: the timer is always cleared (no orphan handles keeping
 * the event loop alive), and callers pass an AbortSignal where the
 * underlying I/O supports one so the loser is actually cancelled.
 */
async function withTimeout<T>(probe: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      probe,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('probe timeout')),
          PROBE_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function checkDb(): Promise<CheckStatus> {
  try {
    await withTimeout(db.$queryRaw`SELECT 1`);
    return 'ok';
  } catch (error) {
    logError('health: DB probe failed', error, { action: 'healthCheck' });
    return 'fail';
  }
}

async function checkRedis(): Promise<CheckStatus> {
  // Same config source as rate-limit.service — dev falls back in-memory.
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return 'skipped';
  }
  try {
    const response = await withTimeout(
      fetch(`${env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
    );
    return response.ok ? 'ok' : 'fail';
  } catch (error) {
    logError('health: Redis probe failed', error, { action: 'healthCheck' });
    return 'fail';
  }
}

async function checkStripe(): Promise<CheckStatus> {
  try {
    await withTimeout(getStripe().balance.retrieve());
    return 'ok';
  } catch (error) {
    logError('health: Stripe probe failed', error, { action: 'healthCheck' });
    return 'fail';
  }
}

/** Stuck (PROCESSING > 15 min) or recently FAILED webhook events. */
async function checkStripeEvents(): Promise<CheckStatus> {
  try {
    const [stuck, failed] = await withTimeout(
      Promise.all([
        db.stripeEvent.count({
          where: {
            status: 'PROCESSING',
            // updatedAt, not createdAt (Codex review #121): a FAILED event
            // Stripe redelivers flips back to PROCESSING on its ORIGINAL
            // row — its creation time would flag every retry of an event
            // older than 15 min as stuck the instant it restarts.
            updatedAt: { lt: subMinutes(new Date(), STUCK_PROCESSING_MINUTES) },
          },
        }),
        db.stripeEvent.count({
          where: {
            status: 'FAILED',
            updatedAt: { gte: subHours(new Date(), FAILED_LOOKBACK_HOURS) },
          },
        }),
      ])
    );
    return stuck > 0 || failed > 0 ? 'degraded' : 'ok';
  } catch (error) {
    logError('health: StripeEvent probe failed', error, {
      action: 'healthCheck',
    });
    return 'fail';
  }
}

async function checkScheduledJobs(): Promise<CheckStatus> {
  try {
    const failed = await withTimeout(
      db.scheduledJob.count({
        where: {
          status: 'FAILED',
          updatedAt: { gte: subHours(new Date(), 24) },
        },
      })
    );
    // 'warn', not 'degraded' (review #120): FAILED is terminal and nothing
    // re-touches the row — a single dead J+2 email would otherwise page
    // the on-call as 503 for exactly 24h with no way to acknowledge.
    // Visible in the body and in the admin ops panel; not a page.
    return failed > 0 ? 'warn' : 'ok';
  } catch (error) {
    logError('health: ScheduledJob probe failed', error, {
      action: 'healthCheck',
    });
    return 'fail';
  }
}

export async function GET(request: NextRequest) {
  // Public endpoint with paid probes behind it — per-IP throttle
  // (CLAUDE.md: rate limiting on every new public endpoint).
  const limit = await checkRateLimit(
    `health:${getClientIp(request.headers)}`,
    RATE_LIMIT
  );
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const deep = request.nextUrl.searchParams.get('deep') === '1';

  // One wave: the deep probes are independent of the shallow ones — a
  // hanging DB must not double the response time (2s + 2s) exactly when
  // the monitor needs the 503 fast (review #120).
  const [dbStatus, redisStatus, ...deepStatuses] = await Promise.all([
    checkDb(),
    checkRedis(),
    ...(deep ? [checkStripe(), checkStripeEvents(), checkScheduledJobs()] : []),
  ]);
  const checks: Record<string, CheckStatus> = {
    db: dbStatus ?? 'fail',
    redis: redisStatus ?? 'fail',
  };
  if (deep) {
    checks.stripe = deepStatuses[0] ?? 'fail';
    checks.stripeEvents = deepStatuses[1] ?? 'fail';
    checks.scheduledJobs = deepStatuses[2] ?? 'fail';
  }

  const values = Object.values(checks);
  const status = values.includes('fail')
    ? 'down'
    : values.includes('degraded')
      ? 'degraded'
      : values.includes('warn')
        ? 'warn'
        : 'ok';

  return NextResponse.json(
    { status, checks, timestamp: new Date().toISOString() },
    // down/degraded page the monitor; warn stays 200 (body-visible only).
    { status: status === 'down' || status === 'degraded' ? 503 : 200 }
  );
}
