'use server';

import { db } from '@/server/db';
import { auth } from '@/server/auth';
import { BookingStatus } from '@prisma/client';
import { format } from 'date-fns';
import type { ActionResult } from '@/types/actions';
import { logError } from '@/lib/logger';
import {
  getWineryBookings,
  type BookingFilters,
} from '@/server/queries/booking.queries';
import {
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
} from '@/server/services/email.service';

/**
 * Approve a pending booking (change status to CONFIRMED)
 */
export async function approveBooking(
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
        experience: { select: { title: true, duration: true } },
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
          message: 'Only pending bookings can be approved',
        },
      };
    }

    // Update status to CONFIRMED
    await db.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED },
    });

    // Send confirmation email to client (non-blocking)
    sendBookingConfirmationEmail(booking.visitorEmail, {
      guestName: booking.visitorName,
      experienceTitle: booking.experience.title,
      wineryName: booking.winery.name,
      date: booking.date,
      guestCount: booking.guestCount,
      duration: booking.experience.duration,
      totalPrice: booking.totalPrice,
      bookingRef: booking.reference,
    }).catch((error) => {
      logError('Failed to send booking confirmation email', error, {
        bookingId,
      });
    });

    return { success: true, data: { status: BookingStatus.CONFIRMED } };
  } catch (error) {
    logError('approveBooking error', error, { action: 'approveBooking', bookingId });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to approve booking' },
    };
  }
}

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

    // Update status to CANCELLED_BY_WINERY
    await db.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED_BY_WINERY,
        cancelledAt: new Date(),
      },
    });

    // Send cancellation email to client (non-blocking)
    sendBookingCancellationEmail(booking.visitorEmail, {
      guestName: booking.visitorName,
      experienceTitle: booking.experience.title,
      wineryName: booking.winery.name,
      date: booking.date,
      totalPrice: booking.totalPrice,
      bookingRef: booking.reference,
    }).catch((error) => {
      logError('Failed to send booking rejection email', error, {
        bookingId,
      });
    });

    return { success: true, data: { status: BookingStatus.CANCELLED_BY_WINERY } };
  } catch (error) {
    logError('rejectBooking error', error, { action: 'rejectBooking', bookingId });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to reject booking' },
    };
  }
}

/**
 * Mark a booking as completed (for past bookings only)
 */
export async function markBookingCompleted(
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
    });

    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    // Verify booking is CONFIRMED
    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only confirmed bookings can be marked as completed',
        },
      };
    }

    // Verify booking is in the past
    const [hours, minutes] = booking.timeSlot.split(':').map(Number);
    const bookingDateTime = new Date(booking.date);
    bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

    if (bookingDateTime > new Date()) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot mark future booking as completed',
        },
      };
    }

    // Update status
    await db.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.COMPLETED },
    });

    return { success: true, data: { status: BookingStatus.COMPLETED } };
  } catch (error) {
    logError('markBookingCompleted error', error, { action: 'markBookingCompleted', bookingId });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking status' },
    };
  }
}

/**
 * Mark a booking as no-show (for past bookings only)
 */
export async function markBookingNoShow(
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
    });

    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    // Verify booking is CONFIRMED
    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Only confirmed bookings can be marked as no-show',
        },
      };
    }

    // Verify booking is in the past
    const [hours, minutes] = booking.timeSlot.split(':').map(Number);
    const bookingDateTime = new Date(booking.date);
    bookingDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

    if (bookingDateTime > new Date()) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot mark future booking as no-show',
        },
      };
    }

    // Update status
    await db.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.NO_SHOW },
    });

    return { success: true, data: { status: BookingStatus.NO_SHOW } };
  } catch (error) {
    logError('markBookingNoShow error', error, { action: 'markBookingNoShow', bookingId });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking status' },
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
    const csvData = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );

    // Generate filename
    const filename = `bookings_${winery.slug}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    return { success: true, data: { csvData, filename } };
  } catch (error) {
    logError('exportBookingsToCSV error', error, { action: 'exportBookingsToCSV' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to export bookings' },
    };
  }
}

/**
 * Get client history with winery (used by ClientDetailsModal)
 */
export async function getClientHistory(
  visitorEmail: string
): Promise<
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
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get client history' },
    };
  }
}
