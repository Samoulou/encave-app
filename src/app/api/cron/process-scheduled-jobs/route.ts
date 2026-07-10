import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import {
  runDueJobs,
  type ScheduledJobHandler,
} from '@/server/services/scheduled-jobs.service';
import { processTastingRecapJob } from '@/server/services/tasting-recap.service';
import { TASTING_RECAP_JOB_TYPE } from '@/lib/constants/wine';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Generic ScheduledJob drain (P-07 / decision A2), hourly. Each job type
 * is gated by its feature flag HERE: a disabled type is never claimed, so
 * flag OFF = its jobs stay PENDING with 0 extra attempts (reversible).
 * P-09 (GIFT_CARD_DELIVERY) and P-10 (REQUEST_OFFER_REMINDER) plug into
 * the same registry.
 */
const HANDLERS: Record<string, ScheduledJobHandler> = {
  [TASTING_RECAP_JOB_TYPE]: processTastingRecapJob,
};

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const startedAt = Date.now();

  try {
    const enabledTypes: string[] = [];
    if (await isFlagEnabled('TASTING_SHEET')) {
      enabledTypes.push(TASTING_RECAP_JOB_TYPE);
    }

    const stats = await runDueJobs({ enabledTypes, handlers: HANDLERS });

    logInfo('scheduled_jobs.cron_drain', {
      action: 'cronProcessScheduledJobs',
      enabledTypes,
      ...stats,
    });
    return NextResponse.json({
      enabledTypes,
      ...stats,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logError('process-scheduled-jobs cron error', error, {
      action: 'cronProcessScheduledJobs',
    });
    return NextResponse.json(
      { error: 'Internal server error', durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
