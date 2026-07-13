'use server';

import { headers } from 'next/headers';
import crypto from 'crypto';
import type Stripe from 'stripe';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { addMinutes } from 'date-fns';
import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';
import { getBaseUrl } from '@/lib/env';
import { getTranslations } from 'next-intl/server';
import type { ActionResult } from '@/types/actions';
import {
  BookingStatus,
  ExperienceStatus,
  Locale,
  OccurrenceStatus,
  WineryStatus,
  type Prisma,
} from '@prisma/client';
import { timeSlotSchema, createHoldSchema } from '@/lib/validators/booking';
import { AGE_GATE_VERSION } from '@/lib/constants/consent';
import {
  HOLD_DURATION_MINUTES,
  STRIPE_SESSION_DURATION_MINUTES,
  HOLD_EMAIL_DOMAIN,
  buildHoldPlaceholderEmail,
  isHoldPlaceholderEmail,
} from '@/lib/constants/booking-hold';
import { BOOKING_FEE_CENTS } from '@/lib/constants/pricing';
import {
  activeCapacityBookingWhere,
  resolveOccurrenceCapacity,
} from '@/lib/business-rules/capacity';
import {
  resolveOccurrence,
  OccurrenceResolutionError,
  type ResolvedOccurrence,
} from '@/server/services/occurrence.service';
import {
  computeCommissionCents,
  getEffectiveCommissionRate,
} from '@/lib/business-rules/commission';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import { getPlatformCommissionRate } from '@/server/services/payment.service';
import {
  redeemGiftCardInTx,
  releaseGiftForBooking,
} from '@/server/services/giftCard-redemption.service';
import { settleGiftTransfer } from '@/server/services/giftCard-transfer.service';
import { confirmGiftFullyCoveredBooking } from '@/server/services/checkout-confirmation.service';
import {
  checkRateLimit,
  getClientIp,
  BOOKING_RATE_LIMIT,
  HOLD_RATE_LIMIT,
} from '@/server/services/rate-limit.service';
import { withSerializableRetry } from '@/server/services/serializable-retry.service';
import { logError, logWarn } from '@/lib/logger';

/** sha256 hex — same scheme as the booking access tokens (SEC-002). */
function hashHoldToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** UI locale ('fr' | 'de' | 'en') → persisted Booking.locale (P-07). */
function toBookingLocale(locale: 'fr' | 'de' | 'en' | undefined): Locale {
  if (locale === 'de') return Locale.DE;
  if (locale === 'en') return Locale.EN;
  return Locale.FR;
}

/**
 * Resolve the occurrence backing a slot BEFORE the Serializable
 * transaction (ADR-0002 §3). Flag ON: a refusal (blocked date, illegal
 * slot, closed occurrence) blocks the booking. Flag OFF: best-effort —
 * the occurrenceId is stamped when resolvable, but nothing ever blocks
 * (pure P-04 behavior).
 */
async function resolveOccurrenceForBooking(input: {
  experienceId: string;
  bookingDate: Date;
  timeSlot: string;
  occurrenceCapacityOn: boolean;
}): Promise<
  | { ok: true; occurrence: ResolvedOccurrence | null }
  | { ok: false; code: 'DATE_BLOCKED' | 'INVALID_SLOT' | 'OCCURRENCE_CLOSED' }
> {
  const { experienceId, bookingDate, timeSlot, occurrenceCapacityOn } = input;
  let occurrence: ResolvedOccurrence | null = null;
  try {
    occurrence = await resolveOccurrence(experienceId, bookingDate, timeSlot);
  } catch (error) {
    if (error instanceof OccurrenceResolutionError) {
      if (occurrenceCapacityOn) return { ok: false, code: error.code };
      return { ok: true, occurrence: null };
    }
    if (occurrenceCapacityOn) throw error;
    logWarn('Occurrence resolution failed (flag OFF, best-effort)', {
      action: 'resolveOccurrenceForBooking',
      experienceId,
      error: String(error),
    });
    return { ok: true, occurrence: null };
  }
  if (occurrenceCapacityOn && occurrence.status !== OccurrenceStatus.OPEN) {
    return { ok: false, code: 'OCCURRENCE_CLOSED' };
  }
  return { ok: true, occurrence };
}

/**
 * Effective slot capacity INSIDE the Serializable transaction: re-read
 * the occurrence by PK (a pure read — holds don't conflict with each
 * other, but close-vs-create does, deliberately: closing is
 * authoritative at creation time). Throws the same string errors the
 * transaction bodies already translate.
 */
async function effectiveCapacityInTx(
  tx: Prisma.TransactionClient,
  input: {
    occurrence: ResolvedOccurrence | null;
    occurrenceCapacityOn: boolean;
    maxCapacity: number;
  }
): Promise<number> {
  const { occurrence, occurrenceCapacityOn, maxCapacity } = input;
  if (!occurrenceCapacityOn || occurrence === null) return maxCapacity;
  const current = await tx.experienceOccurrence.findUnique({
    where: { id: occurrence.id },
    select: { status: true, capacityOverride: true },
  });
  if (!current) throw new Error('NO_CAPACITY');
  if (current.status !== OccurrenceStatus.OPEN) {
    throw new Error('OCCURRENCE_CLOSED');
  }
  return resolveOccurrenceCapacity(current.capacityOverride, maxCapacity);
}

/** ActionResult error for a refused slot resolution. */
function occurrenceRefusalError(
  code: 'DATE_BLOCKED' | 'INVALID_SLOT' | 'OCCURRENCE_CLOSED'
): { success: false; error: { code: typeof code; message: string } } {
  const messages = {
    DATE_BLOCKED: 'This date is not open for booking',
    INVALID_SLOT: 'This time slot is not available for booking',
    OCCURRENCE_CLOSED: 'This time slot has been closed by the winery',
  } as const;
  return { success: false, error: { code, message: messages[code] } };
}

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
  guestCount: z.number().int().positive(),
  visitorName: z.string().min(2),
  // The hold sentinel domain is the ONLY hold/booking discriminator —
  // it must never be forgeable from the outside (security review): a
  // paid booking on that domain would vanish from the winery dashboard.
  visitorEmail: z
    .string()
    .email()
    .refine((email) => !isHoldPlaceholderEmail(email), {
      message: 'Reserved email domain',
    }),
  visitorPhone: z.string().min(6),
  ageConfirmed: z.literal(true),
  /** Locale of the checkout UI — used for the Stripe line-item labels. */
  locale: z.enum(['fr', 'de', 'en']).optional(),
  /**
   * Fee/ticket the UI displayed. If the flag flipped since render, the
   * charge would differ from the accepted total — refuse and let the
   * client refresh (never charge more or less than displayed).
   */
  displayedServiceFeeCentsPerGuest: z.number().int().min(0),
  /** Gift card code applied at checkout (P-09). Flag-gated server-side. */
  giftCode: z.string().trim().min(4).max(24).optional(),
  /**
   * Gift amount the UI displayed as covered. If the authoritative applied
   * amount differs (card drained meanwhile), refuse with GIFT_CHANGED —
   * never charge a different card total than accepted (mirror of the fee
   * guard).
   */
  displayedGiftAppliedCents: z.number().int().min(0).optional(),
  /** Hold created at « Continuer » (L-050) — claimed by this submit. */
  holdId: z.string().cuid().optional(),
  /**
   * Proof of hold ownership: the secret returned by createBookingHold.
   * Without it a leaked booking id would let a third party overwrite the
   * visitor identity of someone else's in-flight booking.
   */
  holdToken: z.string().min(16).optional(),
});

export interface BookingHoldResult {
  holdId: string;
  /** Ownership secret — required to claim or replace this hold. */
  holdToken: string;
  /** ISO timestamp — drives the checkout countdown. */
  expiresAt: string;
}

/**
 * Reserve the slot for 10 minutes at « Continuer », BEFORE the checkout
 * form (P-04 / L-050). The hold is a PENDING_PAYMENT booking with
 * placeholder visitor data; the checkout submit claims and completes it.
 * Expired holds stop counting against capacity immediately (logical
 * release) — the cron and the Stripe webhook only clean rows up.
 */
export async function createBookingHold(
  input: z.infer<typeof createHoldSchema>
): Promise<ActionResult<BookingHoldResult>> {
  try {
    const validated = createHoldSchema.safeParse(input);
    if (!validated.success) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input data' },
      };
    }
    const { experienceId, date, timeSlot, guestCount } = validated.data;
    const { previousHoldId, previousHoldToken } = validated.data;

    // Unauthenticated + reserves capacity → tight per-IP budget.
    const ip = getClientIp(await headers());
    const rateLimitResult = await checkRateLimit(`hold:${ip}`, HOLD_RATE_LIMIT);
    if (!rateLimitResult.success) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many booking attempts. Please try again later.',
        },
      };
    }

    const experience = await db.experience.findUnique({
      where: { id: experienceId },
      include: {
        winery: {
          select: {
            id: true,
            status: true,
            stripeAccountId: true,
            stripeOnboardingComplete: true,
            commissionRate: true,
            cancellationPolicy: true,
          },
        },
      },
    });
    if (
      !experience ||
      experience.status !== ExperienceStatus.PUBLISHED ||
      experience.winery.status !== WineryStatus.VERIFIED ||
      !experience.winery.stripeAccountId ||
      !experience.winery.stripeOnboardingComplete
    ) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Experience is not available for booking',
        },
      };
    }

    if (
      guestCount < experience.minCapacity ||
      guestCount > experience.maxCapacity
    ) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid guest count' },
      };
    }

    // Money snapshot — recomputed authoritatively at submit.
    const totalPrice = experience.price * guestCount;
    const commissionRate = getEffectiveCommissionRate(
      experience.winery,
      getPlatformCommissionRate()
    );
    const platformFee = computeCommissionCents(totalPrice, commissionRate);
    const bookingDate = new Date(date);

    // Occurrence gate (P-05 / ADR-0002): resolve OUTSIDE the Serializable
    // transaction. Refusals block only when the flag is ON.
    const occurrenceCapacityOn = await isFlagEnabled('OCCURRENCE_CAPACITY');
    const resolved = await resolveOccurrenceForBooking({
      experienceId,
      bookingDate,
      timeSlot,
      occurrenceCapacityOn,
    });
    if (!resolved.ok) return occurrenceRefusalError(resolved.code);
    const occurrence = resolved.occurrence;

    const expiresAt = addMinutes(new Date(), HOLD_DURATION_MINUTES);
    const reference = generateBookingReference();
    // Ownership secret: only its holder can claim or replace this hold.
    const holdToken = crypto.randomBytes(24).toString('base64url');
    const holdTokenHash = hashHoldToken(holdToken);
    const previousHoldTokenHash =
      previousHoldId !== undefined && previousHoldToken !== undefined
        ? hashHoldToken(previousHoldToken)
        : undefined;

    let hold;
    try {
      hold = await withSerializableRetry(
        () =>
          db.$transaction(
            async (tx) => {
              // Release the caller's previous UNCLAIMED hold first (Back
              // button, changed party size) — otherwise the user
              // self-blocks on their own seats. Guarded by the token hash
              // + sentinel email + no Stripe session: a claimed booking
              // is never deletable this way.
              if (previousHoldId !== undefined && previousHoldTokenHash) {
                await tx.booking.deleteMany({
                  where: {
                    id: previousHoldId,
                    status: BookingStatus.PENDING_PAYMENT,
                    accessTokenHash: previousHoldTokenHash,
                    visitorEmail: { endsWith: `@${HOLD_EMAIL_DOMAIN}` },
                    stripeCheckoutSessionId: null,
                  },
                });
              }
              // Capacity NUMBER and OPEN gate come from the occurrence;
              // seat COUNTING stays on (date, timeSlot) — unchanged P-04
              // predicate (ADR-0002 D1).
              const capacity = await effectiveCapacityInTx(tx, {
                occurrence,
                occurrenceCapacityOn,
                maxCapacity: experience.maxCapacity,
              });
              const existingBookings = await tx.booking.aggregate({
                where: {
                  experienceId,
                  date: bookingDate,
                  timeSlot,
                  ...activeCapacityBookingWhere(),
                },
                _sum: { guestCount: true },
              });
              const bookedCount = existingBookings._sum.guestCount ?? 0;
              if (guestCount > capacity - bookedCount) {
                throw new Error('NO_CAPACITY');
              }
              return tx.booking.create({
                data: {
                  reference,
                  experienceId,
                  wineryId: experience.winery.id,
                  occurrenceId: occurrence?.id ?? null,
                  date: bookingDate,
                  timeSlot,
                  guestCount,
                  totalPrice,
                  platformFee,
                  serviceFeeCents: 0, // set at submit (flag read then)
                  wineryPayout: totalPrice - platformFee,
                  // Placeholder visitor — replaced when the hold is claimed.
                  visitorName: '',
                  visitorEmail: buildHoldPlaceholderEmail(reference),
                  visitorPhone: '',
                  status: BookingStatus.PENDING_PAYMENT,
                  cancellationPolicy: experience.winery.cancellationPolicy,
                  accessTokenHash: holdTokenHash,
                  expiresAt,
                },
              });
            },
            { isolationLevel: 'Serializable', timeout: 10000 }
          ),
        'createBookingHold'
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
      if (txError instanceof Error && txError.message === 'OCCURRENCE_CLOSED') {
        return occurrenceRefusalError('OCCURRENCE_CLOSED');
      }
      throw txError;
    }

    return {
      success: true,
      data: {
        holdId: hold.id,
        holdToken,
        expiresAt: expiresAt.toISOString(),
      },
    };
  } catch (error) {
    logError('createBookingHold error', error, { action: 'createBookingHold' });
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to hold the slot' },
    };
  }
}

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
    // Narrowed once here — the closure below can't see the guard.
    const stripeAccountId = experience.winery.stripeAccountId;

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
    // Stripe enforces a >= 30 min session expiry; claiming a hold extends
    // it from the 10-min form window to the payment window. Refreshed to
    // the session's actual expiry once Stripe answers.
    const expiresAt = addMinutes(new Date(), STRIPE_SESSION_DURATION_MINUTES);

    // Claim the upstream hold (L-050): same slot, same party size, still
    // alive, and OWNED — the token hash proves the caller created the
    // hold, so a leaked booking id can't hijack someone else's booking.
    // Atomic — a lost claim (expired hold) falls back to a fresh
    // capacity-checked create below, which will answer NO_CAPACITY
    // honestly if the seats were resold.
    let booking: { id: string; reference: string } | undefined;
    if (
      validated.data.holdId !== undefined &&
      validated.data.holdToken !== undefined
    ) {
      const claimed = await db.booking.updateMany({
        where: {
          id: validated.data.holdId,
          accessTokenHash: hashHoldToken(validated.data.holdToken),
          status: BookingStatus.PENDING_PAYMENT,
          expiresAt: { gt: new Date() },
          experienceId,
          date: bookingDate,
          timeSlot,
          guestCount,
        },
        data: {
          visitorName,
          visitorEmail,
          visitorPhone,
          // Client locale — emails to the client are sent in this language.
          locale: toBookingLocale(validated.data.locale),
          totalPrice,
          platformFee,
          serviceFeeCents,
          wineryPayout,
          cancellationPolicy: experience.winery.cancellationPolicy,
          expiresAt,
          ageConfirmedAt: new Date(),
          ageConfirmedVersion: AGE_GATE_VERSION,
        },
      });
      if (claimed.count === 1) {
        const claimedBooking = await db.booking.findUniqueOrThrow({
          where: { id: validated.data.holdId },
          select: { id: true, reference: true, stripeCheckoutSessionId: true },
        });
        booking = claimedBooking;
        // A re-claim (retry after payment abort) must kill the previous
        // Stripe session: two live sessions on one booking let a stale
        // session's expiry webhook delete a booking being paid on the
        // newer one. Best-effort — an already-expired session throws.
        if (claimedBooking.stripeCheckoutSessionId) {
          try {
            await getStripe().checkout.sessions.expire(
              claimedBooking.stripeCheckoutSessionId
            );
          } catch (expireError) {
            logWarn('Could not expire previous checkout session', {
              action: 'createBookingAndCheckout',
              bookingId: claimedBooking.id,
              sessionId: claimedBooking.stripeCheckoutSessionId,
              error: String(expireError),
            });
          }
        }
      }
    }

    // BACK-001 FIX: Use serializable transaction to prevent race condition double bookings
    // This ensures capacity check and booking creation are atomic
    try {
      if (booking === undefined) {
        // Fallback create (no hold / lost claim). Occurrence resolved
        // OUTSIDE the Serializable tx (ADR-0002 §3); the successful-claim
        // path above deliberately does NOT re-validate the occurrence —
        // closing is forward-only and spares live holds mid-payment.
        const occurrenceCapacityOn = await isFlagEnabled('OCCURRENCE_CAPACITY');
        const resolved = await resolveOccurrenceForBooking({
          experienceId,
          bookingDate,
          timeSlot,
          occurrenceCapacityOn,
        });
        if (!resolved.ok) return occurrenceRefusalError(resolved.code);
        const occurrence = resolved.occurrence;

        booking = await withSerializableRetry(
          () =>
            db.$transaction(
              async (tx) => {
                // Capacity NUMBER + OPEN gate from the occurrence; seat
                // COUNTING stays on (date, timeSlot) — P-04 predicate
                // unchanged (ADR-0002 D1).
                const capacity = await effectiveCapacityInTx(tx, {
                  occurrence,
                  occurrenceCapacityOn,
                  maxCapacity: experience.maxCapacity,
                });
                // Check availability within transaction (atomic with create)
                const existingBookings = await tx.booking.aggregate({
                  where: {
                    experienceId,
                    date: bookingDate,
                    timeSlot,
                    // Logical hold release (L-050): an expired PENDING_PAYMENT
                    // hold no longer blocks capacity, whatever the cron does.
                    ...activeCapacityBookingWhere(),
                  },
                  _sum: { guestCount: true },
                });

                const bookedCount = existingBookings._sum.guestCount ?? 0;
                const remainingCapacity = capacity - bookedCount;

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
                    occurrenceId: occurrence?.id ?? null,
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
                    locale: toBookingLocale(validated.data.locale),
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
                isolationLevel: 'Serializable', // Prevents double bookings
                timeout: 10000, // 10 second timeout
              }
            ),
          'createBookingAndCheckout'
        );
      }
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
      if (txError instanceof Error && txError.message === 'OCCURRENCE_CLOSED') {
        return occurrenceRefusalError('OCCURRENCE_CLOSED');
      }
      throw txError; // Re-throw other errors to be caught by outer catch
    }

    // --- Gift-card redemption (P-09, flag-gated). RESERVE at session
    // creation so the FOR UPDATE lock serializes concurrent redemptions of
    // the same code; the platform→winery transfer of the covered part
    // settles at confirmation (webhook) or inline when the card total is 0
    // (Luca design §3). Amounts in cents. Flag OFF ⇒ this whole block is a
    // no-op and the booking path is byte-identical to before.
    const giftEnabled = await isFlagEnabled('GIFT_CARDS');
    const giftCode =
      giftEnabled && validated.data.giftCode
        ? validated.data.giftCode.trim()
        : undefined;
    const dueCents = totalPrice + serviceFeeCents;
    let giftAppliedCents = 0;
    if (giftCode) {
      const reservation = await db.$transaction((tx) =>
        redeemGiftCardInTx(tx, {
          code: giftCode,
          dueCents,
          experienceId,
          bookingId: booking.id,
        })
      );
      if (!reservation.ok) {
        // The booking stays a PENDING hold (expires normally); the client
        // corrects the code and resubmits.
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `GIFT_${reservation.error}`,
          },
        };
      }
      giftAppliedCents = reservation.result.appliedCents;
      // Guard mirror of FEE_CHANGED: never charge a card total the client
      // did not accept (the code may have been drained since the preview).
      if (
        validated.data.displayedGiftAppliedCents !== undefined &&
        validated.data.displayedGiftAppliedCents !== giftAppliedCents
      ) {
        await releaseGiftForBooking(booking.id);
        return {
          success: false,
          error: { code: 'CONFLICT', message: 'GIFT_CHANGED' },
        };
      }
      await db.booking.update({
        where: { id: booking.id },
        data: {
          giftCardId: reservation.result.giftCardId,
          giftAppliedCents,
        },
      });
    }
    const cardCents = dueCents - giftAppliedCents;

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
    const loc = validated.data.locale ?? 'fr';

    // Gift covers the whole due → no Stripe session (Checkout refuses a 0
    // total). Confirm server-side and settle the winery transfer inline
    // (Luca design §4). The REDEMPTION is already reserved above.
    if (giftAppliedCents > 0 && cardCents === 0) {
      const confirmation = await confirmGiftFullyCoveredBooking(booking.id);
      if (
        confirmation.result !== 'confirmed' &&
        confirmation.result !== 'already_confirmed'
      ) {
        // Could not confirm — release the gift so the funds aren't stuck.
        await releaseGiftForBooking(booking.id);
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to confirm gift booking',
          },
        };
      }
      try {
        await settleGiftTransfer(booking.id);
      } catch (transferError) {
        // Booking stays CONFIRMED (client owes nothing); the reconciliation
        // cron retries the transfer. Never fail the client on this.
        logError(
          'Gift transfer failed inline — cron will retry',
          transferError,
          {
            action: 'createBookingAndCheckout',
            bookingId: booking.id,
          }
        );
      }
      const confirmationUrl = confirmation.accessToken
        ? `${baseUrl}/${loc}/booking/${booking.id}?token=${confirmation.accessToken}`
        : `${baseUrl}/${loc}/booking/${booking.id}`;
      return {
        success: true,
        data: {
          bookingId: booking.id,
          bookingReference: booking.reference,
          checkoutUrl: confirmationUrl,
        },
      };
    }

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

    // TWINT first for the Swiss market, Link + cards behind (L-051).
    // If the Stripe account has TWINT disabled, sessions.create rejects
    // the type — fall back to card-only and log (decision D4: enabling
    // TWINT is a Stripe-dashboard action, no deploy needed).
    const buildSessionParams = (
      paymentMethodTypes: ('twint' | 'card' | 'link')[]
    ): Stripe.Checkout.SessionCreateParams => {
      // Computed at CALL time, per attempt: Stripe enforces its 30-min
      // floor against the session's creation clock, and P2034 backoff or
      // a failed TWINT attempt can burn seconds since `expiresAt` was
      // set. One minute of margin keeps every retry above the floor; the
      // booking row is refreshed to the session's real expiry after
      // creation.
      const sessionExpiresAtUnix =
        Math.floor(Date.now() / 1000) +
        STRIPE_SESSION_DURATION_MINUTES * 60 +
        60;

      // Gift branch (P-09, Luca §1): SEPARATE charges & transfers. The
      // client is charged only `cardCents` on the PLATFORM (no
      // transfer_data, no application_fee); the winery payout `P` is a
      // standalone transfer settled at confirmation, so full coverage
      // (cardCents small) can never underpay the winery. The no-gift path
      // keeps the classic destination charge, untouched.
      const isGiftBranch = giftAppliedCents > 0;

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
        isGiftBranch
          ? [
              {
                price_data: {
                  currency: 'chf',
                  product_data: {
                    name: experience.title,
                    description: `${guestCount} ${guestCount === 1 ? 'guest' : 'guests'} - ${experience.winery.name}`,
                  },
                  // Net of the gift already applied to the ledger.
                  unit_amount: cardCents,
                },
                quantity: 1,
              },
            ]
          : [
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
                        currency: 'chf' as const,
                        product_data: { name: serviceFeeLabel },
                        unit_amount: BOOKING_FEE_CENTS,
                      },
                      quantity: guestCount,
                    },
                  ]
                : []),
            ];

      const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData =
        isGiftBranch
          ? {
              // Correlates the platform charge with the standalone winery
              // transfer created at confirmation (settleGiftTransfer).
              transfer_group: `booking_${booking.id}`,
            }
          : {
              // Commission + client fee: both platform revenue. Omitted when
              // 0 (Founder at 0% with the fee OFF) — Stripe rejects a zero fee.
              ...(platformFee + serviceFeeCents > 0
                ? { application_fee_amount: platformFee + serviceFeeCents }
                : {}),
              transfer_data: { destination: stripeAccountId },
            };

      return {
        payment_method_types: paymentMethodTypes,
        mode: 'payment',
        line_items: lineItems,
        payment_intent_data: paymentIntentData,
        customer_email: visitorEmail,
        success_url: `${baseUrl}/booking/${booking.id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        // Aborted/failed payment → dedicated error page (L-052). The
        // booking row IS the hold, alive until the Stripe session expiry —
        // holdToken lets the legitimate visitor (and only them) retry.
        cancel_url: `${baseUrl}/reservation/erreur?${new URLSearchParams({
          cause: 'payment',
          slug: experience.slug,
          date,
          time: timeSlot,
          guests: String(guestCount),
          holdId: booking.id,
          ...(validated.data.holdToken !== undefined
            ? { holdToken: validated.data.holdToken }
            : {}),
          holdExpiresAt: new Date(sessionExpiresAtUnix * 1000).toISOString(),
        }).toString()}`,
        expires_at: sessionExpiresAtUnix,
        metadata: {
          bookingId: booking.id,
          bookingReference: booking.reference,
          // Signals the confirmation webhook to settle the platform→winery
          // transfer for the gift-covered part (P-09).
          ...(giftAppliedCents > 0
            ? { giftAppliedCents: String(giftAppliedCents) }
            : {}),
        },
      };
    };

    // A payment-method rejection is a typed Stripe error pointing at the
    // payment_method_types param — never sniff the human message (any
    // error mentioning « link » would trigger a doomed retry).
    const isPaymentMethodRejection = (err: unknown): boolean => {
      if (typeof err !== 'object' || err === null) return false;
      const { type, param } = err as { type?: unknown; param?: unknown };
      return (
        type === 'StripeInvalidRequestError' &&
        typeof param === 'string' &&
        param.startsWith('payment_method_types')
      );
    };

    let session;
    try {
      session = await getStripe().checkout.sessions.create(
        buildSessionParams(['twint', 'card', 'link'])
      );
    } catch (stripeError) {
      if (!isPaymentMethodRejection(stripeError)) {
        throw stripeError;
      }
      logWarn('Payment method rejected — falling back to card only (D4)', {
        action: 'createBookingAndCheckout',
        error:
          stripeError instanceof Error
            ? stripeError.message
            : String(stripeError),
      });
      session = await getStripe().checkout.sessions.create(
        buildSessionParams(['card'])
      );
    }

    // Attach the session and align the hold's expiry on the session's
    // REAL one — capacity release and payment window must agree, and the
    // countdown/cancel_url promised the client this deadline.
    await db.booking.update({
      where: { id: booking.id },
      data: {
        stripeCheckoutSessionId: session.id,
        ...(session.expires_at
          ? { expiresAt: new Date(session.expires_at * 1000) }
          : {}),
      },
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
