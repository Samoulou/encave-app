'use server';

import crypto from 'crypto';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';
import { getBaseUrl } from '@/lib/env';
import { getTranslations } from 'next-intl/server';
import type { ActionResult } from '@/types/actions';
import { BookingStatus, ExperienceStatus, WineryStatus } from '@prisma/client';
import { timeSlotSchema } from '@/lib/validators/booking';
import { AGE_GATE_VERSION } from '@/lib/constants/consent';
import { BOOKING_FEE_CENTS } from '@/lib/constants/pricing';
import {
  computeCommissionCents,
  getEffectiveCommissionRate,
} from '@/lib/business-rules/commission';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getPlatformCommissionRate } from '@/server/services/payment.service';
import {
  checkRateLimit,
  BOOKING_RATE_LIMIT,
} from '@/server/services/rate-limit.service';
import { logError } from '@/lib/logger';

/**
 * Generate booking reference using cuid2 for guaranteed uniqueness.
 * Format: ENC-XXXXXXXX (ENC prefix + 8 chars from cuid2)
 * PERF-002 FIX: Replaced N+1 query loop with synchronous cuid2 generation.
 */
function generateBookingReference(): string {
  return `ENC-${createId().slice(0, 8).toUpperCase()}`;
}

const CreateBookingSchema = z.object({
  experienceId: z.string(),
  wineryId: z.string(),
  date: z.string(),
  timeSlot: timeSlotSchema, // BACK-003 FIX: Validate HH:mm format
  guestCount: z.number().positive(),
  visitorName: z.string().min(2),
  visitorEmail: z.string().email(),
  visitorPhone: z.string().min(6),
  ageConfirmed: z.literal(true),
  /** Locale of the checkout UI — used for the Stripe line-item labels. */
  locale: z.enum(['fr', 'de', 'en']).optional(),
  /**
   * Fee/ticket the UI displayed. If the flag flipped since render, the
   * charge would differ from the accepted total — refuse and let the
   * client refresh (never charge more or less than displayed).
   */
  displayedServiceFeeCentsPerGuest: z.number().int().min(0).optional(),
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
      date,
      timeSlot,
      guestCount,
      visitorName,
      visitorEmail,
      visitorPhone,
    } = validated.data;

    // Rate limit by visitor email to prevent booking abuse
    const rateLimitResult = await checkRateLimit(
      `booking:${visitorEmail}`,
      BOOKING_RATE_LIMIT
    );
    if (!rateLimitResult.success) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many booking attempts. Please try again later.',
        },
      };
    }

    // Get experience and winery details
    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      include: {
        winery: {
          select: {
            id: true,
            name: true,
            status: true,
            stripeAccountId: true,
            stripeOnboardingComplete: true,
            commissionRate: true,
            cancellationPolicy: true,
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

    if (validated.data.wineryId !== experience.winery.id) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Experience does not belong to the selected winery',
        },
      };
    }

    if (experience.status !== ExperienceStatus.PUBLISHED) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Experience is not available for booking',
        },
      };
    }

    if (experience.winery.status !== WineryStatus.VERIFIED) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Winery is not available for booking',
        },
      };
    }

    if (
      !experience.winery.stripeAccountId ||
      !experience.winery.stripeOnboardingComplete
    ) {
      return {
        success: false,
        error: {
          code: 'STRIPE_NOT_READY',
          message: 'Winery payment setup not complete',
        },
      };
    }

    // Calculate prices. totalPrice/platformFee/wineryPayout keep their
    // historical meaning (fee EXCLUDED); the client is charged
    // totalPrice + serviceFeeCents. The fee and the commission both go to
    // the platform via application_fee_amount — never to the winery.
    const totalPrice = experience.price * guestCount;
    const commissionRate = getEffectiveCommissionRate(
      experience.winery,
      getPlatformCommissionRate()
    );
    const platformFee = computeCommissionCents(totalPrice, commissionRate);
    const wineryPayout = totalPrice - platformFee;
    const bookingFeeEnabled = await isFlagEnabled('BOOKING_FEE');
    const serviceFeeCentsPerGuest = bookingFeeEnabled ? BOOKING_FEE_CENTS : 0;
    const serviceFeeCents = serviceFeeCentsPerGuest * guestCount;

    if (
      validated.data.displayedServiceFeeCentsPerGuest !== undefined &&
      validated.data.displayedServiceFeeCentsPerGuest !==
        serviceFeeCentsPerGuest
    ) {
      return {
        success: false,
        error: {
          code: 'FEE_CHANGED',
          message:
            'The service fee changed while you were booking. Please refresh.',
        },
      };
    }

    const bookingDate = new Date(date);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // BACK-001 FIX: Use serializable transaction to prevent race condition double bookings
    // This ensures capacity check and booking creation are atomic
    let booking;
    try {
      booking = await db.$transaction(
        async (tx) => {
          // Check availability within transaction (atomic with create)
          const existingBookings = await tx.booking.aggregate({
            where: {
              experienceId,
              date: bookingDate,
              timeSlot,
              status: {
                in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
              },
            },
            _sum: { guestCount: true },
          });

          const bookedCount = existingBookings._sum.guestCount ?? 0;
          const remainingCapacity = experience.maxCapacity - bookedCount;

          if (guestCount > remainingCapacity) {
            throw new Error('NO_CAPACITY');
          }

          // PERF-002 FIX: Generate unique reference synchronously using cuid2
          // cuid2 guarantees uniqueness without database lookups
          const reference = generateBookingReference();

          // Create booking within same transaction
          return tx.booking.create({
            data: {
              reference,
              experienceId,
              wineryId: experience.winery.id,
              date: bookingDate,
              timeSlot,
              guestCount,
              totalPrice,
              platformFee,
              serviceFeeCents,
              wineryPayout,
              visitorName,
              visitorEmail,
              visitorPhone,
              status: BookingStatus.PENDING_PAYMENT,
              // Contractual snapshot: refunds use the policy the client
              // accepted here, never the winery's later edits.
              cancellationPolicy: experience.winery.cancellationPolicy,
              expiresAt,
              ageConfirmedAt: new Date(),
              ageConfirmedVersion: AGE_GATE_VERSION,
            },
          });
        },
        {
          isolationLevel: 'Serializable', // Prevents concurrent booking race conditions
          timeout: 10000, // 10 second timeout
        }
      );
    } catch (txError) {
      if (txError instanceof Error && txError.message === 'NO_CAPACITY') {
        return {
          success: false,
          error: {
            code: 'NO_CAPACITY',
            message: 'Not enough availability for this time slot',
          },
        };
      }
      throw txError; // Re-throw other errors to be caught by outer catch
    }

    // Stripe-hosted page label, in the client's locale.
    const serviceFeeLabel =
      serviceFeeCents > 0
        ? (
            await getTranslations({
              locale: validated.data.locale ?? 'fr',
              namespace: 'checkout',
            })
          )('serviceFee')
        : '';

    // Create Stripe Checkout Session
    const baseUrl = getBaseUrl();

    if (process.env.E2E_TEST === 'true') {
      const checkoutUrl = `https://checkout.stripe.com/pay/e2e_${booking.id}`;

      await db.booking.update({
        where: { id: booking.id },
        data: { stripePaymentIntentId: `e2e_${booking.id}` },
      });

      return {
        success: true,
        data: {
          bookingId: booking.id,
          bookingReference: booking.reference,
          checkoutUrl,
        },
      };
    }

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
        // Client booking fee — always a separate visible line, never
        // blended into the experience price (BUSINESS §2).
        ...(serviceFeeCents > 0
          ? [
              {
                price_data: {
                  currency: 'chf',
                  product_data: {
                    name: serviceFeeLabel,
                  },
                  unit_amount: BOOKING_FEE_CENTS,
                },
                quantity: guestCount,
              },
            ]
          : []),
      ],
      payment_intent_data: {
        // Commission + client fee: both platform revenue. Omitted when 0
        // (Founder at 0% with the fee OFF) — Stripe rejects a zero fee.
        ...(platformFee + serviceFeeCents > 0
          ? { application_fee_amount: platformFee + serviceFeeCents }
          : {}),
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
      data: { stripeCheckoutSessionId: session.id },
    });

    if (!session.url) {
      return {
        success: false,
        error: {
          code: 'STRIPE_ERROR',
          message: 'Failed to create checkout session',
        },
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
    logError('createBookingAndCheckout error', error, {
      action: 'createBookingAndCheckout',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking' },
    };
  }
}

export async function getBookingByReference(
  reference: string,
  accessToken: string
): Promise<
  ActionResult<{
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
  }>
> {
  try {
    const accessTokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

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

    if (!booking || booking.accessTokenHash !== accessTokenHash) {
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
    logError('getBookingByReference error', error, {
      action: 'getBookingByReference',
    });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get booking' },
    };
  }
}

export async function getBookingById(
  id: string,
  accessToken: string
): Promise<
  ActionResult<{
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
  }>
> {
  try {
    const accessTokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

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

    if (!booking || booking.accessTokenHash !== accessTokenHash) {
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
    logError('getBookingById error', error, { action: 'getBookingById' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get booking' },
    };
  }
}
