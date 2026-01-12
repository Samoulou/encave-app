'use server';

import { z } from 'zod';
import Stripe from 'stripe';
import { db } from '@/server/db';
import { env, getBaseUrl } from '@/lib/env';
import type { ActionResult } from '@/types/actions';
import { BookingStatus } from '@prisma/client';

// Initialize Stripe
const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { typescript: true })
  : null;

function getStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  return stripe;
}

// Generate booking reference: ENC-XXXXXX
function generateBookingReference(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let reference = 'ENC-';
  for (let i = 0; i < 6; i++) {
    reference += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return reference;
}

const CreateBookingSchema = z.object({
  experienceId: z.string(),
  wineryId: z.string(),
  date: z.string(),
  timeSlot: z.string(),
  guestCount: z.number().positive(),
  visitorName: z.string().min(2),
  visitorEmail: z.string().email(),
  visitorPhone: z.string().min(6),
});

export interface CheckoutResult {
  bookingId: string;
  bookingReference: string;
  checkoutUrl: string;
}

export async function createBookingAndCheckout(
  input: z.infer<typeof CreateBookingSchema>
): Promise<ActionResult<CheckoutResult>> {
  try {
    const validated = CreateBookingSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input data' },
      };
    }

    const {
      experienceId,
      wineryId,
      date,
      timeSlot,
      guestCount,
      visitorName,
      visitorEmail,
      visitorPhone,
    } = validated.data;

    // Get experience and winery details
    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      include: {
        winery: {
          select: {
            id: true,
            name: true,
            stripeAccountId: true,
            stripeOnboardingComplete: true,
          },
        },
      },
    });

    if (!experience) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Experience not found' },
      };
    }

    if (!experience.winery.stripeAccountId || !experience.winery.stripeOnboardingComplete) {
      return {
        success: false,
        error: { code: 'STRIPE_NOT_READY', message: 'Winery payment setup not complete' },
      };
    }

    // Check availability
    const bookingDate = new Date(date);
    const existingBookings = await db.booking.aggregate({
      where: {
        experienceId,
        date: bookingDate,
        timeSlot,
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED] },
      },
      _sum: { guestCount: true },
    });

    const bookedCount = existingBookings._sum.guestCount ?? 0;
    const remainingCapacity = experience.maxCapacity - bookedCount;

    if (guestCount > remainingCapacity) {
      return {
        success: false,
        error: { code: 'NO_CAPACITY', message: 'Not enough availability for this time slot' },
      };
    }

    // Calculate prices
    const totalPrice = experience.price * guestCount;
    const platformFee = Math.round(totalPrice * env.PLATFORM_COMMISSION_RATE);
    const wineryPayout = totalPrice - platformFee;

    // Generate unique reference
    let reference = generateBookingReference();
    let referenceExists = true;
    let attempts = 0;

    while (referenceExists && attempts < 10) {
      const existing = await db.booking.findUnique({ where: { reference } });
      if (!existing) {
        referenceExists = false;
      } else {
        reference = generateBookingReference();
        attempts++;
      }
    }

    // Create booking with PENDING_PAYMENT status
    // Set expiration to 30 minutes from now
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const booking = await db.booking.create({
      data: {
        reference,
        experienceId,
        wineryId,
        date: bookingDate,
        timeSlot,
        guestCount,
        totalPrice,
        platformFee,
        wineryPayout,
        visitorName,
        visitorEmail,
        visitorPhone,
        status: BookingStatus.PENDING_PAYMENT,
        expiresAt,
      },
    });

    // Create Stripe Checkout Session
    const baseUrl = getBaseUrl();

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'chf',
            product_data: {
              name: experience.title,
              description: `${guestCount} ${guestCount === 1 ? 'guest' : 'guests'} - ${experience.winery.name}`,
            },
            unit_amount: experience.price,
          },
          quantity: guestCount,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: experience.winery.stripeAccountId,
        },
      },
      customer_email: visitorEmail,
      success_url: `${baseUrl}/booking/${booking.id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/experiences/${experience.slug}/checkout?date=${date}&time=${timeSlot}&guests=${guestCount}&error=cancelled`,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      metadata: {
        bookingId: booking.id,
        bookingReference: booking.reference,
      },
    });

    // Update booking with Stripe session ID
    await db.booking.update({
      where: { id: booking.id },
      data: { stripePaymentIntentId: session.id },
    });

    if (!session.url) {
      return {
        success: false,
        error: { code: 'STRIPE_ERROR', message: 'Failed to create checkout session' },
      };
    }

    return {
      success: true,
      data: {
        bookingId: booking.id,
        bookingReference: booking.reference,
        checkoutUrl: session.url,
      },
    };
  } catch (error) {
    console.error('createBookingAndCheckout error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking' },
    };
  }
}

export async function getBookingByReference(
  reference: string
): Promise<ActionResult<{
  id: string;
  reference: string;
  status: BookingStatus;
  visitorName: string;
  visitorEmail: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  experience: {
    title: string;
    slug: string;
    duration: number;
    coverPhoto: string;
  };
  winery: {
    name: string;
    address: string;
    commune: string;
  };
}>> {
  try {
    const booking = await db.booking.findUnique({
      where: { reference },
      include: {
        experience: {
          select: {
            title: true,
            slug: true,
            duration: true,
            coverPhoto: true,
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

    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    return {
      success: true,
      data: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        visitorName: booking.visitorName,
        visitorEmail: booking.visitorEmail,
        date: booking.date,
        timeSlot: booking.timeSlot,
        guestCount: booking.guestCount,
        totalPrice: booking.totalPrice,
        experience: booking.experience,
        winery: booking.winery,
      },
    };
  } catch (error) {
    console.error('getBookingByReference error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get booking' },
    };
  }
}

export async function getBookingById(
  id: string
): Promise<ActionResult<{
  id: string;
  reference: string;
  status: BookingStatus;
  visitorName: string;
  visitorEmail: string;
  date: Date;
  timeSlot: string;
  guestCount: number;
  totalPrice: number;
  experience: {
    title: string;
    slug: string;
    duration: number;
    coverPhoto: string;
  };
  winery: {
    name: string;
    address: string;
    commune: string;
    phone: string;
    email: string;
  };
}>> {
  try {
    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        experience: {
          select: {
            title: true,
            slug: true,
            duration: true,
            coverPhoto: true,
          },
        },
        winery: {
          select: {
            name: true,
            address: true,
            commune: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' },
      };
    }

    return {
      success: true,
      data: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        visitorName: booking.visitorName,
        visitorEmail: booking.visitorEmail,
        date: booking.date,
        timeSlot: booking.timeSlot,
        guestCount: booking.guestCount,
        totalPrice: booking.totalPrice,
        experience: booking.experience,
        winery: booking.winery,
      },
    };
  } catch (error) {
    console.error('getBookingById error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get booking' },
    };
  }
}
