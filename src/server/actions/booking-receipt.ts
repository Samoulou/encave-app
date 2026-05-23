'use server';

import { BookingStatus } from '@prisma/client';
import { format } from 'date-fns';
import type { ActionResult } from '@/types/actions';
import { db } from '@/server/db';
import { logError } from '@/lib/logger';
import { generateBookingReceiptPDF } from '@/server/services/booking-receipt.service';

interface ExportBookingReceiptResult {
  pdf: string;
  filename: string;
}

export async function exportBookingReceiptPDF(
  bookingId: string,
  checkoutSessionId: string | null
): Promise<ActionResult<ExportBookingReceiptResult>> {
  try {
    if (!checkoutSessionId) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing checkout session.',
        },
      };
    }

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        experience: {
          select: {
            title: true,
            duration: true,
          },
        },
        winery: {
          select: {
            name: true,
            address: true,
            commune: true,
          },
        },
      },
    });

    if (
      !booking ||
      booking.stripeCheckoutSessionId !== checkoutSessionId ||
      booking.status !== BookingStatus.CONFIRMED
    ) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Receipt not available for this booking.',
        },
      };
    }

    const pdfBuffer = await generateBookingReceiptPDF({
      reference: booking.reference,
      visitorName: booking.visitorName,
      visitorEmail: booking.visitorEmail,
      experienceTitle: booking.experience.title,
      wineryName: booking.winery.name,
      wineryAddress: booking.winery.address,
      wineryCommune: booking.winery.commune,
      date: booking.date,
      timeSlot: booking.timeSlot,
      durationMinutes: booking.experience.duration,
      guestCount: booking.guestCount,
      totalPrice: booking.totalPrice,
      generatedAt: new Date(),
    });

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `encave-receipt-${booking.reference}-${dateStr}.pdf`;

    return {
      success: true,
      data: {
        pdf: pdfBuffer.toString('base64'),
        filename,
      },
    };
  } catch (error) {
    logError('exportBookingReceiptPDF error', error, {
      action: 'exportBookingReceiptPDF',
      bookingId,
    });

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate receipt. Please try again.',
      },
    };
  }
}
