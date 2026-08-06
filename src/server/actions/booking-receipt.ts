'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { BookingStatus } from '@prisma/client';
import { format } from 'date-fns';
import type { ActionResult } from '@/types/actions';
import { db } from '@/server/db';
import {
  API_RATE_LIMIT,
  checkRateLimit,
  getClientIp,
} from '@/server/services/rate-limit.service';
import { logError } from '@/lib/logger';
import { generateBookingReceiptPDF } from '@/server/services/booking-receipt.service';
import type { Locale } from '@/i18n/routing';

const ReceiptInputSchema = z.object({
  bookingId: z.string().min(1),
  checkoutSessionId: z.string().min(1),
});

interface ExportBookingReceiptResult {
  pdf: string;
  filename: string;
}

export async function exportBookingReceiptPDF(
  bookingId: string,
  checkoutSessionId: string | null
): Promise<ActionResult<ExportBookingReceiptResult>> {
  try {
    const parsed = ReceiptInputSchema.safeParse({
      bookingId,
      checkoutSessionId,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing checkout session.' },
      };
    }

    // Public, checkout-session-id-authorized endpoint returning PII — rate
    // limit per IP so a leaked cs_ id can't be enumerated or scraped at
    // volume. (Stronger owner/token authorization is tracked as a follow-up.)
    const ip = getClientIp(await headers());
    const rate = await checkRateLimit(`receipt:${ip}`, API_RATE_LIMIT);
    if (!rate.success) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many receipt requests' },
      };
    }

    const booking = await db.booking.findUnique({
      where: { id: parsed.data.bookingId },
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
      booking.stripeCheckoutSessionId !== parsed.data.checkoutSessionId ||
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

    const pdfBuffer = await generateBookingReceiptPDF(
      {
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
        serviceFeeCents: booking.serviceFeeCents,
        generatedAt: new Date(),
      },
      // Client receipt in the booking's own locale (Prisma FR/DE/EN → routing).
      booking.locale.toLowerCase() as Locale
    );

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
