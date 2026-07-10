import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import type { FlagKey } from '@/lib/flags';
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
 * Generic ScheduledJob drain (P-07 / decision A2), every 3h — eight
 * once-daily vercel.json entries (?slot=N): the Vercel Hobby plan
 * rejects sub-daily cron expressions at deploy time; a Pro upgrade can
 * collapse them back to one hourly `0 * * * *` entry. ONE registry
 * entry per job type — its kill-switch flag and its handler live side by
 * side, so a type can never be enabled without a handler (the split that
 * would park jobs FAILED on a config mistake). A disabled type is never
 * claimed: flag OFF = its jobs stay PENDING with 0 extra attempts
 * (reversible). P-09 (GIFT_CARD_DELIVERY) and P-10
 * (REQUEST_OFFER_REMINDER) plug in as new entries.
 */
const JOB_REGISTRY: {
  type: string;
  flag: FlagKey;
  handler: ScheduledJobHandler;
}[] = [
  {
    type: TASTING_RECAP_JOB_TYPE,
    flag: 'TASTING_SHEET',
    handler: processTastingRecapJob,
  },
];

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const startedAt = Date.now();

  try {
    const flags = await Promise.all(
      JOB_REGISTRY.map((entry) => isFlagEnabled(entry.flag))
    );
    const enabled = JOB_REGISTRY.filter((_, index) => flags[index] === true);
    const enabledTypes = enabled.map((entry) => entry.type);
    const handlers = Object.fromEntries(
      enabled.map((entry) => [entry.type, entry.handler])
    );

    const stats = await runDueJobs({ enabledTypes, handlers });

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
