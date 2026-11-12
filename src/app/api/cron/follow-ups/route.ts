import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import { sendPostExperienceFollowUpEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
  logEmailSkipped,
} from '@/server/services/email-log.service';
import { getClientUnsubscribe } from '@/server/services/email-preferences.service';
import { startOfDay, subHours } from 'date-fns';
import { zonedWallClockToUTC } from '@/lib/datetime/zurich';
import { BookingStatus, ScheduledJobStatus } from '@prisma/client';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { tastingRecapDedupeKey } from '@/lib/constants/wine';
import { mapWithConcurrency } from '@/lib/utils/concurrency';
import { logError, logWarn } from '@/lib/logger';

export const dynamic = 'force-dynamic';
// Per-booking email round-trips — the default budget truncated a busy day
// silently. The run stops ITSELF before the cutoff (RUN_BUDGET_MS); what is
// left is picked up by the next daily run (open-ended window below).
export const maxDuration = 300;

/** Stop starting new sends after this long (maxDuration is 300 s). */
const RUN_BUDGET_MS = 240_000;
/** Low enough for the Resend send rate. */
const SEND_CONCURRENCY = 5;

function toDateOnlyUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
}

function getBookingStartTime(date: Date, timeSlot: string): Date {
  // @db.Date is UTC-midnight; timeSlot is a Europe/Zurich wall-clock.
  return zonedWallClockToUTC(date, timeSlot);
}

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const deadline = Date.now() + RUN_BUDGET_MS;
  const results = {
    sent: 0,
    failed: 0,
    skippedRecapArmed: 0,
    skippedOptedOut: 0,
    deferred: 0,
  };

  try {
    // P-16 (WS-E): Sentry check-in — a missed run = dead cron alert.
    return await withCronMonitor('encave-follow-ups', async () => {
      // Find completed bookings whose session ended at least ~22h ago. This is
      // OPEN-ENDED below (no lower window bound): a booking missed on one daily
      // run is caught on the next, with followUpSentAt as the idempotency guard
      // — the old 4h band [now-26h, now-22h] on a once-daily cron skipped, then
      // permanently aged out, every session ending outside that narrow slice.
      const followUpCutoff = subHours(now, 22);
      const bookings = await db.booking.findMany({
        where: {
          status: BookingStatus.COMPLETED,
          followUpSentAt: null,
          // 72h floor recovers a fully-missed cron day (the previous 48h floor
          // dropped bookings whose single eligible run was skipped).
          date: {
            gte: toDateOnlyUTC(startOfDay(subHours(now, 72))),
            lte: toDateOnlyUTC(startOfDay(followUpCutoff)),
          },
        },
        // Only what the email renders (the old `include` dragged the full
        // experience + winery rows, descriptions included).
        select: {
          id: true,
          visitorEmail: true,
          visitorName: true,
          locale: true,
          date: true,
          timeSlot: true,
          experience: { select: { title: true, duration: true } },
          winery: { select: { name: true } },
        },
      });

      // P-07 / D4: when the tasting loop is ON and a booking has a recap
      // armed (a non-CANCELLED TASTING_RECAP job — the sheet was filled),
      // the generic J+1 follow-up is SKIPPED: the J+2 « coups de cœur »
      // replaces it. Flag OFF = this whole block is inert (empty Set).
      const recapArmed = new Set<string>();
      if (bookings.length > 0 && (await isFlagEnabled('TASTING_SHEET'))) {
        const jobs = await db.scheduledJob.findMany({
          where: {
            dedupeKey: { in: bookings.map((b) => tastingRecapDedupeKey(b.id)) },
            // Armed = will be (or was) delivered. FAILED is deliberately
            // NOT armed: if the recap died permanently, the generic J+1
            // follow-up must still go out — never zero post-visit emails.
            status: {
              in: [
                ScheduledJobStatus.PENDING,
                ScheduledJobStatus.PROCESSING,
                ScheduledJobStatus.DONE,
              ],
            },
          },
          select: { dedupeKey: true },
        });
        for (const job of jobs) {
          if (job.dedupeKey) recapArmed.add(job.dedupeKey);
        }
      }

      await mapWithConcurrency(bookings, SEND_CONCURRENCY, async (booking) => {
        // The claim below sets followUpSentAt BEFORE the send (so two
        // overlapping runs never both email); this flag tells the catch
        // whether it has to be released.
        let claimed = false;
        try {
          // Filter by actual experience end time.
          const bookingStartTime = getBookingStartTime(
            booking.date,
            booking.timeSlot
          );
          const experienceEndTime = new Date(
            bookingStartTime.getTime() + booking.experience.duration * 60 * 1000
          );

          // Only skip a session that is still too recent (< 22h). No lower
          // bound → a session missed on one run is caught the next; the
          // followUpSentAt guard prevents a double send.
          if (experienceEndTime > followUpCutoff) {
            return;
          }

          // D4 skip — deliberately WITHOUT setting followUpSentAt: nothing was
          // sent (the J+2 recap replaces it). This booking re-appears on later
          // runs until its date passes the 72h floor, always hitting this skip
          // (never a duplicate email — the branch below never sends).
          if (recapArmed.has(tastingRecapDedupeKey(booking.id))) {
            await logEmailSkipped(
              'follow_up',
              booking.visitorEmail,
              'tasting_recap_armed',
              booking.id
            );
            results.skippedRecapArmed++;
            return;
          }

          if (Date.now() > deadline) {
            results.deferred++;
            return;
          }

          // Opt-out + tokenised unsubscribe link (same preference row as the
          // tasting recap): this email is not transactional, the client may
          // refuse it. An opted-out booking is marked handled — it will
          // never be sent, no point re-evaluating it for three days.
          const preference = await getClientUnsubscribe(booking.visitorEmail);
          if (preference.optedOut) {
            await db.booking.updateMany({
              where: { id: booking.id, followUpSentAt: null },
              data: { followUpSentAt: new Date() },
            });
            await logEmailSkipped(
              'follow_up',
              booking.visitorEmail,
              'opted_out',
              booking.id
            );
            results.skippedOptedOut++;
            return;
          }

          const claim = await db.booking.updateMany({
            where: { id: booking.id, followUpSentAt: null },
            data: { followUpSentAt: new Date() },
          });
          if (claim.count !== 1) {
            return;
          }
          claimed = true;

          const success = await sendPostExperienceFollowUpEmail(
            booking.visitorEmail,
            {
              guestName: booking.visitorName,
              experienceTitle: booking.experience.title,
              wineryName: booking.winery.name,
              date: bookingStartTime,
              unsubscribeUrl: preference.unsubscribeUrl,
            },
            booking.locale
          );

          if (success) {
            await logEmailSent('follow_up', booking.visitorEmail, booking.id);
            results.sent++;
            return;
          }

          // Nothing left: release the claim so the next daily run retries.
          await db.booking.updateMany({
            where: { id: booking.id },
            data: { followUpSentAt: null },
          });
          claimed = false;
          await logEmailFailed(
            'follow_up',
            booking.visitorEmail,
            'Failed to send',
            booking.id
          );
          results.failed++;
        } catch (error) {
          logError('FollowUps cron error for booking', error, {
            action: 'cronFollowUps',
            bookingId: booking.id,
          });
          if (claimed) {
            await db.booking
              .updateMany({
                where: { id: booking.id },
                data: { followUpSentAt: null },
              })
              .catch(() => undefined);
          }
          await logEmailFailed(
            'follow_up',
            booking.visitorEmail,
            error instanceof Error ? error.message : 'Unknown error',
            booking.id
          );
          results.failed++;
        }
      });

      if (results.deferred > 0) {
        logWarn('follow-ups cron hit its time budget — rest left to next run', {
          action: 'cronFollowUps',
          deferred: results.deferred,
        });
      }

      return NextResponse.json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    logError('FollowUps cron error', error, { action: 'cronFollowUps' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
