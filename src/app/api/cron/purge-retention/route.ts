import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import { logError } from '@/lib/logger';
import { purgeExpiredData } from '@/server/services/retention.service';

export const dynamic = 'force-dynamic';
// Batched deletes with their own 240 s budget (retention.service) — the
// function limit only has to sit above it.
export const maxDuration = 300;

/**
 * Daily retention purge (quality lot, audit A10): old informational email
 * logs, dead rate-limit rows, expired sessions and verification codes,
 * finished deferred jobs. Rules and retention periods live in
 * `retention.service.ts`. Idempotent — a second run the same day finds
 * nothing left to delete.
 */
export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const run = async () => {
    const stats = await purgeExpiredData();
    // A run cut by its time budget is not a failure (the next one resumes)
    // but a backlog that large deserves a look.
    if (stats.timedOut) {
      Sentry.captureMessage('purge-retention: time budget exhausted', {
        level: 'warning',
        tags: { area: 'cron' },
        extra: { ...stats },
      });
    }
    return NextResponse.json(stats);
  };

  try {
    return await withCronMonitor('encave-purge-retention', run);
  } catch (error) {
    logError('purge-retention cron failed', error, {
      action: 'purgeRetentionCron',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
