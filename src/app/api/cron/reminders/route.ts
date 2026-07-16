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
import { addHours, startOfDay } from 'date-fns';
import { BookingStatus } from '@prisma/client';
import { logError } from '@/lib/logger';
import { zonedHourOf } from '@/lib/datetime/zurich';
import { zurichTodayAsUTCDate } from '@/lib/business-rules/occurrence-expansion';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The J-1 reminder (#2) goes out at 18h local (Europe/Zurich) — L-164. */
const REMINDER_LOCAL_HOUR = 18;

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateOnlyUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
}

function getBookingDateTime(date: Date, timeSlot: string): Date {
  const [hours, minutes] = timeSlot.split(':').map(Number);
  const bookingDateTime = new Date(date);
  bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return bookingDateTime;
}

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results = {
    reminder24h: { sent: 0, failed: 0, skipped: 0 },
    reminder2h: { sent: 0, failed: 0, skipped: 0 },
  };

  try {
    // P-16 (WS-E): Sentry check-in — a missed run = dead cron alert.
    return await withCronMonitor('encave-reminders', async () => {
      // J-1 reminder (#2): scheduled at BOTH 16:00 and 17:00 UTC (vercel.json);
      // only the run matching 18h Europe/Zurich acts — DST-proof (same doctrine
      // as tasting-sheet-reminder). Scoped HERE so it never gates the independent
      // 2h block below (which needs its own cadence).
      if (zonedHourOf(now) === REMINDER_LOCAL_HOUR) {
        // Fires the EVENING BEFORE (18h Zurich) → target tomorrow's Zurich calendar
        // day. `@db.Date` is UTC-midnight; +24h in UTC is exactly the next date.
        const tomorrowUTC = new Date(
          zurichTodayAsUTCDate(now).getTime() + DAY_MS
        );
        const bookings24h = await db.booking.findMany({
          where: {
            status: BookingStatus.CONFIRMED,
            reminder24hSentAt: null,
            date: tomorrowUTC,
          },
          include: {
            experience: true,
            winery: true,
          },
        });

        // Send day-before reminders
        for (const booking of bookings24h) {
          try {
            // Combine date and time slot for the email
            const bookingDateTime = getBookingDateTime(
              booking.date,
              booking.timeSlot
            );

            const success = await sendBookingReminderEmail(
              booking.visitorEmail,
              {
                guestName: booking.visitorName,
                experienceTitle: booking.experience.title,
                wineryName: booking.winery.name,
                wineryAddress: booking.winery.address,
                date: bookingDateTime,
                guestCount: booking.guestCount,
                bookingRef: booking.reference,
                isTomorrow: true,
              },
              // Client email in the guest's own locale (persisted at checkout).
              booking.locale
            );

            if (success) {
              await db.booking.update({
                where: { id: booking.id },
                data: { reminder24hSentAt: new Date() },
              });
              await logEmailSent(
                'reminder_24h',
                booking.visitorEmail,
                booking.id
              );
              results.reminder24h.sent++;
            } else {
              await logEmailFailed(
                'reminder_24h',
                booking.visitorEmail,
                'Failed to send',
                booking.id
              );
              results.reminder24h.failed++;
            }
          } catch (error) {
            logError('Error sending 24h reminder', error, {
              action: 'cronReminders',
              bookingId: booking.id,
            });
            await logEmailFailed(
              'reminder_24h',
              booking.visitorEmail,
              error instanceof Error ? error.message : 'Unknown error',
              booking.id
            );
            results.reminder24h.failed++;
          }
        }
      }

      // 2h reminder — runs on EVERY invocation, independent of the 18h J-1 guard
      // above. NOTE (pre-existing, out of P-15 scope): this path needs an hourly
      // cron + a Zurich-correct window to reliably fire ~2h before the session;
      // on the current twice-daily schedule it is best-effort. Tracked as debt.
      const bookings2h = await db.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          reminder2hSentAt: null,
          reminder24hSentAt: { not: null }, // 24h reminder should have been sent
          date: {
            gte: toDateOnlyUTC(startOfDay(now)),
            lte: toDateOnlyUTC(startOfDay(addHours(now, 3))),
          },
        },
        include: {
          experience: true,
          winery: true,
        },
      });

      // Filter and send 2h reminders
      for (const booking of bookings2h) {
        try {
          // Parse the time slot and check if it's within 2h window
          const bookingDateTime = getBookingDateTime(
            booking.date,
            booking.timeSlot
          );

          const hoursUntilBooking =
            (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

          // Only send if booking is 1.5-2.5 hours away
          if (hoursUntilBooking < 1.5 || hoursUntilBooking > 2.5) {
            results.reminder2h.skipped++;
            continue;
          }

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

          if (success) {
            await db.booking.update({
              where: { id: booking.id },
              data: { reminder2hSentAt: new Date() },
            });
            await logEmailSent('reminder_2h', booking.visitorEmail, booking.id);
            results.reminder2h.sent++;
          } else {
            await logEmailFailed(
              'reminder_2h',
              booking.visitorEmail,
              'Failed to send',
              booking.id
            );
            results.reminder2h.failed++;
          }
        } catch (error) {
          logError('Error sending 2h reminder', error, {
            action: 'cronReminders',
            bookingId: booking.id,
          });
          await logEmailFailed(
            'reminder_2h',
            booking.visitorEmail,
            error instanceof Error ? error.message : 'Unknown error',
            booking.id
          );
          results.reminder2h.failed++;
        }
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
