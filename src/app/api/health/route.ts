import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { env } from '@/lib/env';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Health probe (P-16 / WS-E, L-184). Polled by an external uptime monitor
 * (1–3 min) — Vercel Hobby has no sub-daily cron, so lag/stuck detection
 * lives HERE, not in a cron. Contract:
 *  - 200 = everything ok; any other status → the monitor alerts.
 *  - `?deep=1` adds the paid/slow probes: Stripe API reachability, stuck
 *    or failed StripeEvents, recent ScheduledJob failures. The shallow
 *    probe stays cheap enough for a 1-min cadence.
 *  - Response carries per-check verdicts only ('ok'|'fail'|'degraded'|
 *    'skipped') — never error details or internals (public endpoint).
 */

const PROBE_TIMEOUT_MS = 2000;
const STUCK_PROCESSING_MINUTES = 15;
const FAILED_LOOKBACK_HOURS = 1;

type CheckStatus = 'ok' | 'fail' | 'degraded' | 'skipped';

async function withTimeout<T>(probe: Promise<T>): Promise<T> {
  return Promise.race([
    probe,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('probe timeout')), PROBE_TIMEOUT_MS)
    ),
  ]);
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
            createdAt: {
              lt: new Date(Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000),
            },
          },
        }),
        db.stripeEvent.count({
          where: {
            status: 'FAILED',
            updatedAt: {
              gte: new Date(
                Date.now() - FAILED_LOOKBACK_HOURS * 60 * 60 * 1000
              ),
            },
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
          updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      })
    );
    return failed > 0 ? 'degraded' : 'ok';
  } catch (error) {
    logError('health: ScheduledJob probe failed', error, {
      action: 'healthCheck',
    });
    return 'fail';
  }
}

export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get('deep') === '1';

  const [dbStatus, redisStatus] = await Promise.all([checkDb(), checkRedis()]);
  const checks: Record<string, CheckStatus> = {
    db: dbStatus,
    redis: redisStatus,
  };

  if (deep) {
    const [stripe, stripeEvents, scheduledJobs] = await Promise.all([
      checkStripe(),
      checkStripeEvents(),
      checkScheduledJobs(),
    ]);
    checks.stripe = stripe;
    checks.stripeEvents = stripeEvents;
    checks.scheduledJobs = scheduledJobs;
  }

  const values = Object.values(checks);
  const status = values.includes('fail')
    ? 'down'
    : values.includes('degraded')
      ? 'degraded'
      : 'ok';

  return NextResponse.json(
    { status, checks, timestamp: new Date().toISOString() },
    // Anything non-200 makes the uptime monitor alert — degraded included.
    { status: status === 'ok' ? 200 : 503 }
  );
}
