import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import {
  sendBookingReminderEmail,
  sendClientReminder2hEmail,
} from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
} from '@/server/services/email-log.service';
import { addHours, subHours } from 'date-fns';
import { BookingStatus } from '@prisma/client';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    // Find bookings for 24h reminder (between 23-25 hours from now)
    const bookings24h = await db.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        reminder24hSentAt: null,
        date: {
          gte: addHours(now, 23),
          lte: addHours(now, 25),
        },
      },
      include: {
        experience: true,
        winery: true,
      },
    });

    // Send 24h reminders
    for (const booking of bookings24h) {
      try {
        // Combine date and time slot for the email
        const [hours, minutes] = booking.timeSlot.split(':').map(Number);
        const bookingDateTime = new Date(booking.date);
        bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

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
          }
        );

        if (success) {
          await db.booking.update({
            where: { id: booking.id },
            data: { reminder24hSentAt: new Date() },
          });
          await logEmailSent('reminder_24h', booking.visitorEmail, booking.id);
          results.reminder24h.sent++;
        } else {
          await logEmailFailed('reminder_24h', booking.visitorEmail, 'Failed to send', booking.id);
          results.reminder24h.failed++;
        }
      } catch (error) {
        logError('Error sending 24h reminder', error, { action: 'cronReminders', bookingId: booking.id });
        await logEmailFailed(
          'reminder_24h',
          booking.visitorEmail,
          error instanceof Error ? error.message : 'Unknown error',
          booking.id
        );
        results.reminder24h.failed++;
      }
    }

    // Find bookings for 2h reminder (between 1.5-2.5 hours from now)
    // Using a wider window to account for time slot parsing
    const bookings2h = await db.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        reminder2hSentAt: null,
        reminder24hSentAt: { not: null }, // 24h reminder should have been sent
        date: {
          // For same-day bookings, date equals today
          gte: subHours(now, 1),
          lte: addHours(now, 24),
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
        const [hours, minutes] = booking.timeSlot.split(':').map(Number);
        const bookingDateTime = new Date(booking.date);
        bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

        const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Only send if booking is 1.5-2.5 hours away
        if (hoursUntilBooking < 1.5 || hoursUntilBooking > 2.5) {
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
          }
        );

        if (success) {
          await db.booking.update({
            where: { id: booking.id },
            data: { reminder2hSentAt: new Date() },
          });
          await logEmailSent('reminder_2h', booking.visitorEmail, booking.id);
          results.reminder2h.sent++;
        } else {
          await logEmailFailed('reminder_2h', booking.visitorEmail, 'Failed to send', booking.id);
          results.reminder2h.failed++;
        }
      } catch (error) {
        logError('Error sending 2h reminder', error, { action: 'cronReminders', bookingId: booking.id });
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
  } catch (error) {
    logError('Reminders cron error', error, { action: 'cronReminders' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
