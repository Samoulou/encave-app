import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { withCronMonitor } from '@/lib/cron-monitor';
import {
  sendBookingReminderEmail,
  sendClientReminder2hEmail,
} from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
} from '@/server/services/email-log.service';
import { BookingStatus } from '@prisma/client';
import { logError, logWarn } from '@/lib/logger';
import { mapWithConcurrency } from '@/lib/utils/concurrency';
import { zonedHourOf, zonedWallClockToUTC } from '@/lib/datetime/zurich';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';

export const dynamic = 'force-dynamic';
// Per-booking email round-trips: the default budget would silently truncate
// a busy evening. The run also stops ITSELF before the cutoff (RUN_BUDGET_MS)
// so no send is ever killed mid-flight.
export const maxDuration = 300;

/**
 * Client reminders, driven by the CLOCK (the handler takes no argument —
 * the ?slot=N of vercel.json only mints distinct daily cron entries, one
 * per hour from 04:00 to 19:00 UTC; on a Vercel Pro plan they collapse
 * into the single expression `0 4-19 * * *`).
 *
 * Every hourly run does two independent things:
 *
 *  1. J-1 reminder (#2) — at 18h Europe/Zurich, for tomorrow's sessions
 *     (L-164). The runs of 19h+ the same evening are the CATCH-UP of a
 *     truncated or failed 18h run: they only take bookings that already
 *     existed at 18h, so a booking made at 20h for tomorrow does not get a
 *     "reminder" an hour after its confirmation.
 *  2. 2h reminder — sessions starting in (1h, 2h30]. Each session is in
 *     that window for two consecutive runs: the first sends (1h30–2h30
 *     before), the second is the catch-up.
 *
 * Exactly-once: a booking is CLAIMED (sent-marker set by a guarded
 * updateMany) BEFORE its email leaves, so two overlapping runs can never
 * both send; a failed send releases the claim and the next run retries.
 */
const REMINDER_LOCAL_HOUR = 18;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** 2h reminder window, in hours before the session start: (min, max]. */
const REMINDER_2H_MIN_HOURS = 1;
const REMINDER_2H_MAX_HOURS = 2.5;

/** Stop starting new sends after this long (maxDuration is 300 s). */
const RUN_BUDGET_MS = 240_000;
/** Low enough for the Resend send rate, high enough to drain an evening. */
const SEND_CONCURRENCY = 5;

const reminderBookingSelect = {
  id: true,
  visitorEmail: true,
  visitorName: true,
  locale: true,
  date: true,
  timeSlot: true,
  guestCount: true,
  reference: true,
  experience: { select: { title: true } },
  winery: { select: { name: true, address: true, phone: true } },
} as const;

interface ReminderCounters {
  sent: number;
  failed: number;
  skipped: number;
  /** Left for the next run because the time budget was reached. */
  deferred: number;
}

function newCounters(): ReminderCounters {
  return { sent: 0, failed: 0, skipped: 0, deferred: 0 };
}

function getBookingDateTime(date: Date, timeSlot: string): Date {
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
    reminder24h: newCounters(),
    reminder2h: newCounters(),
  };

  try {
    // P-16 (WS-E): Sentry check-in — a missed run = dead cron alert.
    return await withCronMonitor('encave-reminders', async () => {
      const zurichHour = zonedHourOf(now);
      const zurichToday = zurichTodayAsUTCDate(now);

      // ── 1. J-1 reminder (#2) ────────────────────────────────────────────
      if (zurichHour >= REMINDER_LOCAL_HOUR) {
        // Fires the EVENING BEFORE → target tomorrow's Zurich calendar day.
        // `@db.Date` is UTC-midnight; +24h in UTC is exactly the next date.
        const tomorrowUTC = new Date(zurichToday.getTime() + DAY_MS);
        const isCatchUp = zurichHour > REMINDER_LOCAL_HOUR;
        const bookings24h = await db.booking.findMany({
          where: {
            status: BookingStatus.CONFIRMED,
            reminder24hSentAt: null,
            date: tomorrowUTC,
            // Catch-up runs only finish the 18h batch (see header).
            ...(isCatchUp
              ? {
                  createdAt: {
                    lt: zonedWallClockToUTC(
                      zurichToday,
                      `${REMINDER_LOCAL_HOUR}:00`
                    ),
                  },
                }
              : {}),
          },
          select: reminderBookingSelect,
        });

        await mapWithConcurrency(
          bookings24h,
          SEND_CONCURRENCY,
          async (booking) => {
            if (Date.now() > deadline) {
              results.reminder24h.deferred++;
              return;
            }
            // Claim first: only the run that flips the marker sends.
            const claim = await db.booking.updateMany({
              where: {
                id: booking.id,
                status: BookingStatus.CONFIRMED,
                reminder24hSentAt: null,
              },
              data: { reminder24hSentAt: new Date() },
            });
            if (claim.count !== 1) {
              results.reminder24h.skipped++;
              return;
            }

            let errorMessage: string | null = null;
            try {
              const success = await sendBookingReminderEmail(
                booking.visitorEmail,
                {
                  guestName: booking.visitorName,
                  experienceTitle: booking.experience.title,
                  wineryName: booking.winery.name,
                  wineryAddress: booking.winery.address,
                  date: getBookingDateTime(booking.date, booking.timeSlot),
                  guestCount: booking.guestCount,
                  bookingRef: booking.reference,
                  isTomorrow: true,
                },
                // Client email in the guest's own locale (persisted at checkout).
                booking.locale
              );
              if (!success) errorMessage = 'Failed to send';
            } catch (error) {
              logError('Error sending 24h reminder', error, {
                action: 'cronReminders',
                bookingId: booking.id,
              });
              errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            }

            if (errorMessage === null) {
              await logEmailSent(
                'reminder_24h',
                booking.visitorEmail,
                booking.id
              );
              results.reminder24h.sent++;
              return;
            }

            // Nothing left: release the claim so the next run retries.
            await db.booking.updateMany({
              where: { id: booking.id },
              data: { reminder24hSentAt: null },
            });
            await logEmailFailed(
              'reminder_24h',
              booking.visitorEmail,
              errorMessage,
              booking.id
            );
            results.reminder24h.failed++;
          }
        );
      }

      // ── 2. 2h reminder ──────────────────────────────────────────────────
      // Coarse SQL filter on the Zurich day(s), exact filter on the real
      // start instant below.
      const bookings2h = await db.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          reminder2hSentAt: null,
          // Only for guests who got the J-1 reminder: a booking made the
          // same day already carries all the practical details in its
          // confirmation email.
          reminder24hSentAt: { not: null },
          date: {
            gte: zurichToday,
            lte: new Date(zurichToday.getTime() + DAY_MS),
          },
        },
        select: reminderBookingSelect,
      });

      await mapWithConcurrency(
        bookings2h,
        SEND_CONCURRENCY,
        async (booking) => {
          const bookingDateTime = getBookingDateTime(
            booking.date,
            booking.timeSlot
          );
          const hoursUntilBooking =
            (bookingDateTime.getTime() - now.getTime()) / HOUR_MS;
          if (
            hoursUntilBooking <= REMINDER_2H_MIN_HOURS ||
            hoursUntilBooking > REMINDER_2H_MAX_HOURS
          ) {
            results.reminder2h.skipped++;
            return;
          }
          if (Date.now() > deadline) {
            results.reminder2h.deferred++;
            return;
          }

          const claim = await db.booking.updateMany({
            where: {
              id: booking.id,
              status: BookingStatus.CONFIRMED,
              reminder2hSentAt: null,
            },
            data: { reminder2hSentAt: new Date() },
          });
          if (claim.count !== 1) {
            results.reminder2h.skipped++;
            return;
          }

          let errorMessage: string | null = null;
          try {
            const success = await sendClientReminder2hEmail(
              booking.visitorEmail,
              {
                guestName: booking.visitorName,
                experienceTitle: booking.experience.title,
                wineryName: booking.winery.name,
                wineryAddress: booking.winery.address,
                wineryPhone: booking.winery.phone,
                date: bookingDateTime,
                guestCount: booking.guestCount,
              },
              // Client email in the guest's own locale (persisted at checkout).
              booking.locale
            );
            if (!success) errorMessage = 'Failed to send';
          } catch (error) {
            logError('Error sending 2h reminder', error, {
              action: 'cronReminders',
              bookingId: booking.id,
            });
            errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
          }

          if (errorMessage === null) {
            await logEmailSent('reminder_2h', booking.visitorEmail, booking.id);
            results.reminder2h.sent++;
            return;
          }

          await db.booking.updateMany({
            where: { id: booking.id },
            data: { reminder2hSentAt: null },
          });
          await logEmailFailed(
            'reminder_2h',
            booking.visitorEmail,
            errorMessage,
            booking.id
          );
          results.reminder2h.failed++;
        }
      );

      const deferred =
        results.reminder24h.deferred + results.reminder2h.deferred;
      if (deferred > 0) {
        logWarn('reminders cron hit its time budget — rest left to next run', {
          action: 'cronReminders',
          deferred,
        });
      }

      return NextResponse.json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    logError('Reminders cron error', error, { action: 'cronReminders' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
