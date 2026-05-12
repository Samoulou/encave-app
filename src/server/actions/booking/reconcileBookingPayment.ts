'use server';

import crypto from 'crypto';
import { BookingStatus } from '@prisma/client';
import { headers } from 'next/headers';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { getStripe, isStripeConfigured } from '@/server/stripe';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { checkRateLimit } from '@/server/services/rate-limit.service';
import { confirmBookingFromCheckoutSession } from '@/server/services/booking-confirmation.service';
import {
  reconcileBookingPaymentSchema,
  type ReconcileBookingPaymentInput,
} from '@/lib/validators/booking';
import type { ActionResult } from '@/types/actions';
import type { PaymentReconciliationState } from '@/types/payment-reconciliation';

/**
 * ENC-067 — Synchronous payment reconciliation server action.
 *
 * Called from the confirmation Server Component when the client lands back
 * from Stripe Checkout. Interrogates Stripe via
 * `checkout.sessions.retrieve` and, if the session is paid, flips the
 * booking to CONFIRMED via the shared service. The webhook remains the
 * source of truth — this is a filet de sécurité for preview deployments
 * (where Stripe webhooks aren't configured) and a fast-path for prod.
 *
 * Idempotence: the underlying `updateMany` in the shared service is
 * atomic on `status: PENDING_PAYMENT`. Concurrent webhook/reconcile calls
 * cannot double-flip a booking nor double-send emails.
 */

/**
 * Auth policy — 3 levels (cf. ADR-0002 §4):
 * 1. Authenticated user's email matches `booking.visitorEmail` AND the
 *    user's email is verified (better-auth `emailVerified === true`).
 *    Email verification is enforced because bookings are guest-keyed by
 *    email — without verification, anyone could claim someone else's
 *    booking by signing up with their email (ENC-067 review H2).
 * 2. Valid `accessToken` matching `booking.accessTokenHash` → OK.
 * 3. Booking is still `PENDING_PAYMENT` AND `booking.stripePaymentIntentId`
 *    is a Stripe Checkout Session id (starts with `cs_`) AND it matches
 *    the supplied sessionId. The sessionId acts as a capability token
 *    (non-guessable, only delivered to the buyer by Stripe's `success_url`
 *    redirect).
 *
 *    ⚠️ Dépendance fragile (cf. ADR-0002 §2 — dette de naming) :
 *    `booking.stripePaymentIntentId` holds a `cs_...` while the booking
 *    is PENDING_PAYMENT, then gets overwritten with a `pi_...` once the
 *    webhook/reconcile path confirms the booking. The `startsWith('cs_')`
 *    guard makes this dependency explicit: if a future refactor changes
 *    the population order (e.g. inline PI write at checkout creation),
 *    level 3 silently bails out instead of matching `pi_...` against the
 *    provided `cs_...` sessionId. Track the rename ticket before relaxing
 *    this guard.
 */
async function authorizeAccess(args: {
  booking: {
    visitorEmail: string;
    accessTokenHash: string | null;
    status: BookingStatus;
    stripePaymentIntentId: string | null;
  };
  sessionUserEmail: string | null;
  sessionUserEmailVerified: boolean;
  providedAccessToken: string | undefined;
  providedSessionId: string;
}): Promise<boolean> {
  const {
    booking,
    sessionUserEmail,
    sessionUserEmailVerified,
    providedAccessToken,
    providedSessionId,
  } = args;

  if (
    sessionUserEmail &&
    sessionUserEmailVerified &&
    sessionUserEmail.toLowerCase() === booking.visitorEmail.toLowerCase()
  ) {
    return true;
  }

  if (providedAccessToken && booking.accessTokenHash) {
    const providedHash = crypto
      .createHash('sha256')
      .update(providedAccessToken)
      .digest('hex');
    const a = Buffer.from(providedHash, 'hex');
    const b = Buffer.from(booking.accessTokenHash, 'hex');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }

  if (
    booking.status === BookingStatus.PENDING_PAYMENT &&
    booking.stripePaymentIntentId !== null &&
    booking.stripePaymentIntentId.startsWith('cs_') &&
    booking.stripePaymentIntentId === providedSessionId
  ) {
    return true;
  }

  return false;
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  );
}

export async function reconcileBookingPayment(
  rawInput: ReconcileBookingPaymentInput
): Promise<ActionResult<PaymentReconciliationState>> {
  // 1. Validation
  const parsed = reconcileBookingPaymentSchema.safeParse(rawInput);
  if (!parsed.success) {
    const rawBookingId = (rawInput as { bookingId?: unknown }).bookingId;
    logWarn('reconcileBookingPayment: validation failed', {
      bookingId: typeof rawBookingId === 'string' ? rawBookingId : undefined,
      issues: parsed.error.issues.map((i) => ({
        path: i.path,
        code: i.code,
        message: i.message,
      })),
    });
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid reconciliation input',
      },
    };
  }
  const { bookingId, sessionId, accessToken } = parsed.data;

  logInfo('reconcileBookingPayment: entered', {
    bookingId,
    sessionIdPrefix: sessionId.slice(0, 12) + '…',
    hasAccessToken: !!accessToken,
  });

  // 2. Rate limit (per IP × booking)
  const ip = await getClientIp();
  const rate = await checkRateLimit(`reconcile:${ip}:${bookingId}`, {
    maxRequests: 5,
    windowMs: 60 * 1000,
  });
  if (!rate.success) {
    logWarn('reconcileBookingPayment: rate limited', { bookingId, ip });
    return {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    };
  }

  // 3. Load booking
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      stripePaymentIntentId: true,
      visitorEmail: true,
      accessTokenHash: true,
    },
  });

  if (!booking) {
    logWarn('reconcileBookingPayment: booking not found', { bookingId });
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Booking not found' },
    };
  }

  // 4. Authorization
  const session = await auth();
  const authorized = await authorizeAccess({
    booking,
    sessionUserEmail: session?.user.email ?? null,
    sessionUserEmailVerified: session?.user.emailVerified === true,
    providedAccessToken: accessToken,
    providedSessionId: sessionId,
  });

  if (!authorized) {
    logWarn('reconcileBookingPayment: forbidden access', {
      bookingId,
      hasSession: !!session,
      hasToken: !!accessToken,
    });
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    };
  }

  // 5. Idempotent short-circuits (no Stripe call)
  if (booking.status === BookingStatus.CONFIRMED) {
    logInfo('reconcileBookingPayment: already CONFIRMED', { bookingId });
    return {
      success: true,
      data: { kind: 'ALREADY_CONFIRMED', bookingId },
    };
  }

  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    logInfo('reconcileBookingPayment: already cancelled/finalized', {
      bookingId,
      status: booking.status,
    });
    return {
      success: true,
      data: {
        kind: 'ALREADY_CANCELLED',
        bookingId,
        status: booking.status,
      },
    };
  }

  // 6. Stripe retrieve
  if (!isStripeConfigured()) {
    logError('reconcileBookingPayment: Stripe not configured', undefined, {
      bookingId,
    });
    return {
      success: false,
      error: {
        code: 'STRIPE_NOT_CONFIGURED',
        message: 'Stripe not configured',
      },
    };
  }

  const stripe = getStripe();
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
  } catch (error) {
    logError('reconcileBookingPayment: Stripe retrieve failed', error, {
      bookingId,
      sessionId,
    });
    return {
      success: false,
      error: { code: 'STRIPE_ERROR', message: 'Stripe lookup failed' },
    };
  }

  // 7. Cross-check session metadata to avoid session reuse
  if (stripeSession.metadata?.bookingId !== bookingId) {
    logWarn('reconcileBookingPayment: session metadata mismatch', {
      bookingId,
      sessionMetadataBookingId: stripeSession.metadata?.bookingId,
    });
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Session does not match booking',
      },
    };
  }

  const now = Date.now();
  const sessionExpired =
    stripeSession.status === 'expired' ||
    (typeof stripeSession.expires_at === 'number' &&
      stripeSession.expires_at * 1000 < now);

  // 8. Branch on session status
  if (sessionExpired) {
    logInfo('reconcileBookingPayment: SESSION_EXPIRED', {
      bookingId,
      sessionId,
    });
    return {
      success: true,
      data: { kind: 'SESSION_EXPIRED' },
    };
  }

  if (stripeSession.payment_status === 'paid') {
    const paymentIntentId =
      typeof stripeSession.payment_intent === 'string'
        ? stripeSession.payment_intent
        : stripeSession.payment_intent?.id;

    if (!paymentIntentId) {
      logError(
        'reconcileBookingPayment: paid session without payment_intent',
        undefined,
        { bookingId, sessionId }
      );
      return {
        success: false,
        error: {
          code: 'STRIPE_ERROR',
          message: 'Missing payment_intent on paid session',
        },
      };
    }

    const result = await confirmBookingFromCheckoutSession({
      bookingId,
      stripeSessionId: stripeSession.id,
      stripePaymentIntentId: paymentIntentId,
      source: 'RECONCILE',
    });

    if (result.confirmed) {
      return {
        success: true,
        data: { kind: 'CONFIRMED', bookingId },
      };
    }

    // count === 0: someone else (webhook) won the race — equivalent UI.
    return {
      success: true,
      data: { kind: 'ALREADY_CONFIRMED', bookingId },
    };
  }

  // payment_status === 'unpaid' (or anything else). Card-only MVP: this means
  // the card was refused, 3DS abandoned, or fraud check rejected. We do NOT
  // write to DB — the 30-min cron will sweep the booking later.
  logInfo('reconcileBookingPayment: PAYMENT_FAILED_INSTANT', {
    bookingId,
    sessionId,
    paymentStatus: stripeSession.payment_status,
    sessionStatus: stripeSession.status,
  });
  return {
    success: true,
    data: { kind: 'PAYMENT_FAILED_INSTANT' },
  };
}
