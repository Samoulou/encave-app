'use server';

import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';
import { createId } from '@paralleldrive/cuid2';
import { BookingStatus, NoShowChargeStatus } from '@prisma/client';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { bookingIdSchema } from '@/lib/validators/eventDetail';
import { isFlagEnabled } from '@/server/queries/feature-flags.queries';
import {
  computeCommissionCents,
  getEffectiveCommissionRate,
} from '@/lib/business-rules/commission';
import { getPlatformCommissionRate } from '@/server/services/payment.service';
import { sendNoShowFeeChargedEmail } from '@/server/services/email.service';
import { logError, logInfo, logWarn } from '@/lib/logger';
import type { ActionResult } from '@/types/actions';

/**
 * Charge the accepted no-show fee off-session (P-08 / L-072, US-220).
 *
 * Triggered MANUALLY by the winemaker, 1 tap, only on a NO_SHOW booking that
 * carries a card imprint. The amount is the per-guest fee the client accepted
 * (noShowFeeCentsSnapshot × guestCount) — never the winery's current setting.
 * Money routing = destination charge: the winery receives the fee net of its
 * tier commission (BUSINESS §2), the platform keeps the commission.
 *
 * Concurrency / double-charge: a conditional PENDING claim (Postgres CAS) lets
 * exactly one attempt run at a time; a fresh idempotency key per attempt makes
 * a retry after a DETERMINISTIC decline (FAILED) a genuine new charge. An
 * ambiguous Stripe failure leaves the row PENDING (never risk a double debit)
 * for manual reconciliation.
 *
 * This same action is the retry: it re-claims from a FAILED state.
 */
export async function chargeNoShowFee(
  input: unknown
): Promise<ActionResult<{ chargedCents: number }>> {
  const parsed = bookingIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid booking id' },
    };
  }

  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    };
  }

  if (!(await isFlagEnabled('NO_SHOW_FEES'))) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'No-show fees are disabled' },
    };
  }

  const booking = await db.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      reference: true,
      status: true,
      guestCount: true,
      visitorEmail: true,
      visitorName: true,
      locale: true,
      date: true,
      timeSlot: true,
      noShowFeeCentsSnapshot: true,
      noShowPolicyAcceptedAt: true,
      noShowFeeChargeStatus: true,
      noShowFeeChargePaymentIntentId: true,
      stripeCustomerId: true,
      noShowPaymentMethodId: true,
      experience: {
        select: {
          title: true,
          winery: {
            select: {
              id: true,
              userId: true,
              name: true,
              stripeAccountId: true,
              commissionRate: true,
              noShowFeeEnabled: true,
            },
          },
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

  const winery = booking.experience.winery;
  if (winery.userId !== session.user.id) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not the owner of this booking' },
    };
  }
  if (!winery.noShowFeeEnabled) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'NOT_ENABLED' },
    };
  }
  if (booking.status !== BookingStatus.NO_SHOW) {
    // Never chargeable outside a no-show — the whole guarantee of US-220.
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'NOT_NO_SHOW' },
    };
  }
  if (
    booking.noShowFeeChargeStatus === NoShowChargeStatus.CHARGED ||
    booking.noShowFeeChargePaymentIntentId
  ) {
    return {
      success: false,
      error: { code: 'CONFLICT', message: 'ALREADY_CHARGED' },
    };
  }
  if (!booking.stripeCustomerId || !booking.noShowPaymentMethodId) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'NO_IMPRINT' },
    };
  }
  if (!winery.stripeAccountId) {
    return {
      success: false,
      error: { code: 'STRIPE_NOT_READY', message: 'Winery payout not ready' },
    };
  }
  const perGuestCents = booking.noShowFeeCentsSnapshot ?? 0;
  if (perGuestCents <= 0) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'NO_FEE' },
    };
  }
  const amountCents = perGuestCents * booking.guestCount;

  // Atomic CAS claim: only reachable from null / FAILED, never from PENDING
  // (in flight) or CHARGED (PI id set). Postgres re-checks the WHERE after the
  // row lock, so a concurrent double-tap loses (count === 0).
  const claim = await db.booking.updateMany({
    where: {
      id: booking.id,
      status: BookingStatus.NO_SHOW,
      noShowFeeChargePaymentIntentId: null,
      noShowFeeChargeStatus: { not: NoShowChargeStatus.PENDING },
    },
    data: { noShowFeeChargeStatus: NoShowChargeStatus.PENDING },
  });
  if (claim.count !== 1) {
    return {
      success: false,
      error: { code: 'CONFLICT', message: 'CHARGE_IN_PROGRESS' },
    };
  }

  const rate = getEffectiveCommissionRate(winery, getPlatformCommissionRate());
  const applicationFeeCents = computeCommissionCents(amountCents, rate);

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await getStripe().paymentIntents.create(
      {
        amount: amountCents,
        currency: 'chf',
        customer: booking.stripeCustomerId,
        payment_method: booking.noShowPaymentMethodId,
        off_session: true,
        confirm: true,
        // Commission on the fee → platform; the rest → winery. Omitted when 0
        // (Founder at 0%) — Stripe rejects a zero application fee.
        ...(applicationFeeCents > 0
          ? { application_fee_amount: applicationFeeCents }
          : {}),
        transfer_data: { destination: winery.stripeAccountId },
        description: `No-show fee — ${booking.experience.title} (${booking.reference})`,
        metadata: {
          bookingId: booking.id,
          bookingReference: booking.reference,
          kind: 'no_show_fee',
        },
      },
      { idempotencyKey: `no-show-fee:${booking.id}:${createId()}` }
    );
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError) {
      // Deterministic: the card was NOT charged → FAILED, retryable.
      await db.booking.update({
        where: { id: booking.id },
        data: { noShowFeeChargeStatus: NoShowChargeStatus.FAILED },
      });
      logWarn('no-show.fee.declined', {
        bookingId: booking.id,
        code: error.code,
        declineCode: error.decline_code,
      });
      return {
        success: false,
        error: {
          code: 'PAYMENT_FAILED',
          message: error.code ?? 'card_declined',
        },
      };
    }
    // Ambiguous outcome (network/unknown): leave PENDING so a retry can never
    // double-charge. Requires manual reconciliation (no-show runbook, P-16).
    logError('no-show.fee.charge_ambiguous', error, {
      bookingId: booking.id,
    });
    return {
      success: false,
      error: {
        code: 'STRIPE_ERROR',
        message: 'Charge could not be confirmed. Please contact support.',
      },
    };
  }

  if (paymentIntent.status !== 'succeeded') {
    // e.g. requires_action — off-session SCA the winemaker cannot complete.
    await db.booking.update({
      where: { id: booking.id },
      data: { noShowFeeChargeStatus: NoShowChargeStatus.FAILED },
    });
    logWarn('no-show.fee.not_succeeded', {
      bookingId: booking.id,
      status: paymentIntent.status,
    });
    return {
      success: false,
      error: { code: 'PAYMENT_FAILED', message: paymentIntent.status },
    };
  }

  // Success — write-once (guarded by the still-null PI id).
  await db.booking.update({
    where: { id: booking.id },
    data: {
      noShowFeeChargeStatus: NoShowChargeStatus.CHARGED,
      noShowFeeChargedCents: amountCents,
      noShowFeeChargePaymentIntentId: paymentIntent.id,
    },
  });

  logInfo('no-show.fee.charged', {
    bookingId: booking.id,
    actorId: session.user.id,
    amountCents,
    applicationFeeCents,
    paymentIntentId: paymentIntent.id,
  });

  // Email #13 (client locale) — best-effort, the money already moved.
  const [hours, minutes] = booking.timeSlot.split(':').map(Number);
  const sessionDate = new Date(booking.date);
  sessionDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  try {
    await sendNoShowFeeChargedEmail(
      booking.visitorEmail,
      {
        firstName: booking.visitorName,
        reference: booking.reference,
        experienceTitle: booking.experience.title,
        wineryName: winery.name,
        date: sessionDate,
        amountCents,
        acceptedAt: booking.noShowPolicyAcceptedAt ?? new Date(),
      },
      booking.locale
    );
  } catch (error) {
    logError('no-show.fee.email_failed', error, { bookingId: booking.id });
  }

  revalidatePath('/dashboard/bookings');
  return { success: true, data: { chargedCents: amountCents } };
}
