import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { verifyCronRequest } from '@/lib/cron-auth';
import { sendPostExperienceFollowUpEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
} from '@/server/services/email-log.service';
import { subHours } from 'date-fns';
import { BookingStatus } from '@prisma/client';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  if (!(await verifyCronRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results = { sent: 0, failed: 0 };

  try {
    // Find completed bookings that ended 22-26 hours ago
    // (experience date + time slot was 22-26 hours ago)
    // We check COMPLETED status which means the experience has occurred
    const bookings = await db.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        followUpSentAt: null,
        // Look for bookings that completed yesterday or earlier
        date: {
          lte: subHours(now, 22),
          gte: subHours(now, 48), // Don't go too far back
        },
      },
      include: {
        experience: true,
        winery: true,
      },
    });

    // Filter by actual experience end time
    for (const booking of bookings) {
      try {
        // Parse the time slot and calculate when experience ended
        const [hours, minutes] = booking.timeSlot.split(':').map(Number);
        const bookingStartTime = new Date(booking.date);
        bookingStartTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

        // Add experience duration to get end time
        const experienceEndTime = new Date(
          bookingStartTime.getTime() + booking.experience.duration * 60 * 1000
        );

        const hoursSinceEnd = (now.getTime() - experienceEndTime.getTime()) / (1000 * 60 * 60);

        // Send follow-up between 22-26 hours after the experience ended
        if (hoursSinceEnd < 22 || hoursSinceEnd > 26) {
          continue;
        }

        const success = await sendPostExperienceFollowUpEmail(
          booking.visitorEmail,
          {
            guestName: booking.visitorName,
            experienceTitle: booking.experience.title,
            wineryName: booking.winery.name,
            date: bookingStartTime,
          }
        );

        if (success) {
          await db.booking.update({
            where: { id: booking.id },
            data: { followUpSentAt: new Date() },
          });
          await logEmailSent('follow_up', booking.visitorEmail, booking.id);
          results.sent++;
        } else {
          await logEmailFailed('follow_up', booking.visitorEmail, 'Failed to send', booking.id);
          results.failed++;
        }
      } catch (error) {
        logError('FollowUps cron error for booking', error, { action: 'cronFollowUps', bookingId: booking.id });
        await logEmailFailed(
          'follow_up',
          booking.visitorEmail,
          error instanceof Error ? error.message : 'Unknown error',
          booking.id
        );
        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError('FollowUps cron error', error, { action: 'cronFollowUps' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
