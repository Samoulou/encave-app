import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import type { FlagKey } from '@/lib/flags';
import {
  runDueJobs,
  type ScheduledJobHandler,
} from '@/server/services/scheduled-jobs.service';
import { processTastingRecapJob } from '@/server/services/tasting-recap.service';
import { processGiftCardDeliveryJob } from '@/server/services/giftCard-delivery.service';
import {
  processRequestOfferReminderJob,
  processRequestOfferExpiryJob,
  processRequestSlaEscalationJob,
} from '@/server/services/request-jobs.service';
import { TASTING_RECAP_JOB_TYPE } from '@/lib/constants/wine';
import { GIFT_CARD_DELIVERY_JOB_TYPE } from '@/lib/constants/gift-card';
import {
  REQUEST_OFFER_REMINDER_JOB_TYPE,
  REQUEST_OFFER_EXPIRY_JOB_TYPE,
  REQUEST_SLA_ESCALATION_JOB_TYPE,
} from '@/lib/constants/request';
import {
  runBookingMaintenanceSweep,
  type BookingMaintenanceResult,
} from '@/server/services/booking-expiration.service';
import { logError, logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Share of the 300 s budget the booking sweep may take after the jobs. */
const BOOKING_MAINTENANCE_BUDGET_MS = 60_000;
const MIN_MAINTENANCE_BUDGET_MS = 10_000;
const RESPONSE_MARGIN_MS = 15_000;

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
  /**
   * Kill-switch of the job type. `null` = ALWAYS runs: reserved to jobs
   * that deliver something already paid for, which a kill-switch must
   * never hold back (the flag gates new sales, not existing obligations).
   */
  flag: FlagKey | null;
  handler: ScheduledJobHandler;
}[] = [
  {
    type: TASTING_RECAP_JOB_TYPE,
    flag: 'TASTING_SHEET',
    handler: processTastingRecapJob,
  },
  {
    type: GIFT_CARD_DELIVERY_JOB_TYPE,
    // A gift card that was PAID is delivered to its recipient whatever the
    // GIFT_CARDS flag says today (the handler still refuses a DISABLED
    // card — fraud / chargeback).
    flag: null,
    handler: processGiftCardDeliveryJob,
  },
  {
    type: REQUEST_OFFER_REMINDER_JOB_TYPE,
    flag: 'REQUESTS',
    handler: processRequestOfferReminderJob,
  },
  {
    type: REQUEST_OFFER_EXPIRY_JOB_TYPE,
    flag: 'REQUESTS',
    handler: processRequestOfferExpiryJob,
  },
  {
    type: REQUEST_SLA_ESCALATION_JOB_TYPE,
    flag: 'REQUESTS',
    handler: processRequestSlaEscalationJob,
  },
];

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const startedAt = Date.now();

  try {
    // P-16 (WS-E): Sentry check-in — a missed run = dead cron alert.
    return await withCronMonitor('encave-process-scheduled-jobs', async () => {
      const flags = await Promise.all(
        JOB_REGISTRY.map((entry) =>
          entry.flag === null ? true : isFlagEnabled(entry.flag)
        )
      );
      const enabled = JOB_REGISTRY.filter((_, index) => flags[index] === true);
      const enabledTypes = enabled.map((entry) => entry.type);
      const handlers = Object.fromEntries(
        enabled.map((entry) => [entry.type, entry.handler])
      );

      const stats = await runDueJobs({ enabledTypes, handlers });

      // Booking maintenance rides the same 3-hourly slots (the dedicated
      // cron only runs once a night): expired pending bookings are
      // cancelled within hours and their reserved gift returned. Bounded,
      // best-effort — it must never fail or starve the job drain above.
      let maintenance: BookingMaintenanceResult | null = null;
      // Never past the function's own limit: whatever the drain left, minus
      // a margin to answer. A long drain simply skips this pass.
      const remainingMs =
        maxDuration * 1000 - (Date.now() - startedAt) - RESPONSE_MARGIN_MS;
      const maintenanceBudgetMs = Math.min(
        BOOKING_MAINTENANCE_BUDGET_MS,
        remainingMs
      );
      try {
        if (maintenanceBudgetMs >= MIN_MAINTENANCE_BUDGET_MS) {
          maintenance = await runBookingMaintenanceSweep({
            budgetMs: maintenanceBudgetMs,
          });
        }
      } catch (error) {
        logError('booking maintenance sweep failed', error, {
          action: 'cronProcessScheduledJobs',
        });
      }

      logInfo('scheduled_jobs.cron_drain', {
        action: 'cronProcessScheduledJobs',
        enabledTypes,
        ...stats,
        maintenance,
      });
      return NextResponse.json({
        enabledTypes,
        ...stats,
        maintenance,
        durationMs: Date.now() - startedAt,
      });
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
