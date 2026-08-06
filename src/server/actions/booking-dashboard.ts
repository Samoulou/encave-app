'use server';

import { db } from '@/server/db';
import { auth } from '@/server/auth';
import { getStripe } from '@/server/stripe';
import { BookingStatus } from '@prisma/client';
import { format } from 'date-fns';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';
import {
  getWineryBookings,
  type BookingFilters,
} from '@/server/queries/booking.queries';
import { sendBookingCancellationEmail } from '@/server/services/email.service';
import { releaseGiftForBooking } from '@/server/services/giftCard-redemption.service';

/**
 * Reject a pending booking (change status to CANCELLED_BY_WINERY)
 */
export async function rejectBooking(
  bookingId: string
): Promise<ActionResult<{ status: BookingStatus }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    // Get winery for the user
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a winery owner' },
      };
    }

    // Get booking and verify ownership
    const booking = await db.booking.findFirst({
      where: { id: bookingId, wineryId: winery.id },
      include: {
        experience: { select: { title: true } },
        winery: { select: { name: true } },
      },
    });

    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    // Verify booking is PENDING_PAYMENT
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only pending bookings can be rejected',
        },
      };
    }

    // Expire the still-open Stripe Checkout session so the guest can no
    // longer pay a booking we are rejecting (mirrors the expire cron and
    // cancelEventSession). A completed/paid session rejects .expire() — the
    // CAS below then matches 0 rows and we keep the confirmed booking.
    if (booking.stripeCheckoutSessionId?.startsWith('cs_')) {
      await getStripe()
        .checkout.sessions.expire(booking.stripeCheckoutSessionId)
        .catch(() => undefined);
    }

    // Atomic CAS: only reject a booking that is STILL pending — a concurrent
    // webhook confirmation (PENDING_PAYMENT → CONFIRMED) must not be clobbered.
    const rejected = await db.booking.updateMany({
      where: { id: bookingId, status: BookingStatus.PENDING_PAYMENT },
      data: {
        status: BookingStatus.CANCELLED_BY_WINERY,
        cancelledAt: new Date(),
      },
    });

    if (rejected.count === 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only pending bookings can be rejected',
        },
      };
    }

    // Return any gift-card funds reserved on this pending booking, matching
    // the expire-cron and expired-webhook cancel paths (no stranded balance).
    await releaseGiftForBooking(bookingId);

    // Send cancellation email to client in their booking locale (non-blocking)
    sendBookingCancellationEmail(
      booking.visitorEmail,
      {
        guestName: booking.visitorName,
        experienceTitle: booking.experience.title,
        wineryName: booking.winery.name,
        date: booking.date,
        totalPrice: booking.totalPrice,
        bookingRef: booking.reference,
      },
      booking.locale
    ).catch((error) => {
      logError('Failed to send booking rejection email', error, {
        bookingId,
      });
    });

    return {
      success: true,
      data: { status: BookingStatus.CANCELLED_BY_WINERY },
    };
  } catch (error) {
    logError('rejectBooking error', error, {
      action: 'rejectBooking',
      bookingId,
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to reject booking' },
    };
  }
}

/**
 * Export bookings to CSV format
 */
export async function exportBookingsToCSV(
  filters?: BookingFilters
): Promise<ActionResult<{ csvData: string; filename: string }>> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    // Get winery for the user
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true, slug: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a winery owner' },
      };
    }

    // Get filtered bookings
    const bookings = await getWineryBookings(winery.id, filters);

    // CSV header
    const headers = [
      'Date',
      'Time',
      'Experience',
      'Client Name',
      'Email',
      'Phone',
      'Guests',
      'Status',
      'Amount (CHF)',
      'Payout (CHF)',
      'Reference',
    ];

    // Format status for display
    const formatStatus = (status: BookingStatus): string => {
      switch (status) {
        case BookingStatus.CONFIRMED:
          return 'Confirmed';
        case BookingStatus.COMPLETED:
          return 'Completed';
        case BookingStatus.CANCELLED_BY_CLIENT:
          return 'Cancelled by Client';
        case BookingStatus.CANCELLED_BY_WINERY:
          return 'Cancelled by Winery';
        case BookingStatus.NO_SHOW:
          return 'No-Show';
        case BookingStatus.PENDING_PAYMENT:
          return 'Pending Payment';
        default:
          return status;
      }
    };

    // Escape CSV field (handle quotes and commas)
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Generate CSV rows
    const rows = bookings.map((booking) => [
      format(new Date(booking.date), 'yyyy-MM-dd'),
      booking.timeSlot,
      escapeCSV(booking.experience.title),
      escapeCSV(booking.visitorName),
      escapeCSV(booking.visitorEmail),
      escapeCSV(booking.visitorPhone),
      booking.guestCount.toString(),
      formatStatus(booking.status),
      (booking.totalPrice / 100).toFixed(2),
      (booking.wineryPayout / 100).toFixed(2),
      booking.reference,
    ]);

    // Combine headers and rows
    const csvData = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // Generate filename
    const filename = `bookings_${winery.slug}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    return { success: true, data: { csvData, filename } };
  } catch (error) {
    logError('exportBookingsToCSV error', error, {
      action: 'exportBookingsToCSV',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to export bookings' },
    };
  }
}

/**
 * Get client history with winery (used by ClientDetailsModal)
 */
export async function getClientHistory(visitorEmail: string): Promise<
  ActionResult<{
    bookings: Array<{
      id: string;
      reference: string;
      date: Date;
      timeSlot: string;
      guestCount: number;
      totalPrice: number;
      status: BookingStatus;
      experience: { title: string };
    }>;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      };
    }

    // Get winery for the user
    const winery = await db.winery.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!winery) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not a winery owner' },
      };
    }

    // Get all bookings for this client with this winery
    const bookings = await db.booking.findMany({
      where: {
        wineryId: winery.id,
        visitorEmail: { equals: visitorEmail, mode: 'insensitive' },
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        reference: true,
        date: true,
        timeSlot: true,
        guestCount: true,
        totalPrice: true,
        status: true,
        experience: {
          select: { title: true },
        },
      },
    });

    return { success: true, data: { bookings } };
  } catch (error) {
    logError('getClientHistory error', error, { action: 'getClientHistory' });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get client history',
      },
    };
  }
}
