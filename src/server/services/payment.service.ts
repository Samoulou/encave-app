import type Stripe from 'stripe';
import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';
import { env, getBaseUrl } from '@/lib/env';
import { logError, logInfo } from '@/lib/logger';

/**
 * Creates a Stripe Connect Express account for a winery
 */
export async function createConnectAccount(wineryId: string): Promise<string> {
  const winery = await db.winery.findUnique({
    where: { id: wineryId },
    include: { user: true },
  });

  if (!winery) {
    throw new Error('Winery not found');
  }

  if (winery.stripeAccountId) {
    // Account already exists, create new onboarding link
    return createOnboardingLink(winery.stripeAccountId);
  }

  const account = await getStripe().accounts.create({
    type: 'express',
    country: 'CH',
    email: winery.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: {
      wineryId: winery.id,
      wineryName: winery.name,
    },
  });

  // Save stripeAccountId to winery
  await db.winery.update({
    where: { id: wineryId },
    data: { stripeAccountId: account.id },
  });

  return createOnboardingLink(account.id);
}

/**
 * Creates an onboarding link for an existing Stripe Connect account
 */
async function createOnboardingLink(accountId: string): Promise<string> {
  const baseUrl = getBaseUrl();

  const accountLink = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/dashboard/stripe/callback?refresh=true`,
    return_url: `${baseUrl}/dashboard/stripe/callback?success=true`,
    type: 'account_onboarding',
  });

  return accountLink.url;
}

/**
 * Gets the Stripe Express dashboard login link for a winemaker
 */
export async function getStripeLoginLink(
  stripeAccountId: string
): Promise<string> {
  const loginLink = await getStripe().accounts.createLoginLink(stripeAccountId);
  return loginLink.url;
}

/**
 * Retrieves Stripe account details to check status
 */
export async function getStripeAccountStatus(stripeAccountId: string): Promise<{
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  requiresAction: boolean;
  requirements: Stripe.Account.Requirements | null;
}> {
  const account = await getStripe().accounts.retrieve(stripeAccountId);

  return {
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    payoutsEnabled: account.payouts_enabled,
    requiresAction:
      (account.requirements?.currently_due?.length ?? 0) > 0 ||
      (account.requirements?.errors?.length ?? 0) > 0,
    requirements: account.requirements ?? null,
  };
}

/**
 * Syncs Stripe account status to the database
 */
export async function syncStripeAccountStatus(
  stripeAccountId: string
): Promise<void> {
  const status = await getStripeAccountStatus(stripeAccountId);

  await db.winery.update({
    where: { stripeAccountId },
    data: {
      stripeOnboardingComplete: status.chargesEnabled,
      stripeDetailsSubmitted: status.detailsSubmitted,
    },
  });
}

/**
 * Checks if a winery can publish experiences (Stripe must be fully onboarded)
 */
export async function canPublishExperiences(wineryId: string): Promise<{
  canPublish: boolean;
  reason?: string;
}> {
  const winery = await db.winery.findUnique({
    where: { id: wineryId },
    select: {
      status: true,
      stripeAccountId: true,
      stripeOnboardingComplete: true,
    },
  });

  if (!winery) {
    return { canPublish: false, reason: 'Winery not found' };
  }

  if (winery.status !== 'VERIFIED') {
    return { canPublish: false, reason: 'Winery not verified' };
  }

  if (!winery.stripeAccountId) {
    return {
      canPublish: false,
      reason: 'Payment setup required. Connect your Stripe account to publish.',
    };
  }

  if (!winery.stripeOnboardingComplete) {
    return {
      canPublish: false,
      reason: 'Complete Stripe onboarding to publish experiences.',
    };
  }

  return { canPublish: true };
}

/**
 * Gets the platform commission rate
 */
export function getPlatformCommissionRate(): number {
  return env.PLATFORM_COMMISSION_RATE;
}

/**
 * Process a refund for a booking
 * Handles both full and partial refunds, including application fee refund.
 * Omitting `amountCents` refunds the full charge; a partial amount
 * reverses the transfer and the application fee proportionally (Stripe).
 *
 * `options.reverseTransfer` (default true) MUST be false for the card
 * charge of a gift-funded booking (P-16 / ADR-0003): that charge is a
 * PLATFORM charge with no transfer attached — Stripe rejects
 * reverse_transfer on it. The winery clawback goes through
 * transfers.createReversal instead.
 */
export async function processRefund(
  stripePaymentIntentOrSessionId: string,
  refundApplicationFee: boolean = true,
  amountCents?: number,
  idempotencyKey?: string,
  options?: { reverseTransfer?: boolean }
): Promise<{ refundId: string; amount: number }> {
  if (
    amountCents !== undefined &&
    (!Number.isInteger(amountCents) || amountCents <= 0)
  ) {
    throw new Error('Refund amount must be a positive integer (cents)');
  }

  // E2E (P-16): payment intents minted by the fake-session convention
  // (`e2e_…`, cf. booking checkout) resolve to a synthetic refund — never
  // call Stripe. The cancellation paths always pass an explicit amount
  // when a refund is due (computeBookingRefund.stripeAmountArg).
  if (
    process.env.E2E_TEST === 'true' &&
    stripePaymentIntentOrSessionId.startsWith('e2e_')
  ) {
    return {
      refundId: `re_e2e_${Date.now()}`,
      amount: amountCents ?? 0,
    };
  }

  let paymentIntentId = stripePaymentIntentOrSessionId;

  if (stripePaymentIntentOrSessionId.startsWith('cs_')) {
    const session = await getStripe().checkout.sessions.retrieve(
      stripePaymentIntentOrSessionId
    );

    if (!session.payment_intent || typeof session.payment_intent !== 'string') {
      throw new Error('No payment intent found for this session');
    }

    paymentIntentId = session.payment_intent;
  }

  if (!paymentIntentId.startsWith('pi_')) {
    throw new Error('Invalid Stripe payment intent ID');
  }

  const refund = await getStripe().refunds.create(
    {
      payment_intent: paymentIntentId,
      reverse_transfer: options?.reverseTransfer ?? true,
      refund_application_fee: refundApplicationFee,
      ...(amountCents !== undefined ? { amount: amountCents } : {}),
    },
    // Concurrent duplicates collapse into one refund at Stripe. Partial
    // refunds made this race real (two 50% refunds both succeed).
    idempotencyKey !== undefined ? { idempotencyKey } : undefined
  );

  return {
    refundId: refund.id,
    amount: refund.amount,
  };
}

function isAlreadyRefundedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === 'charge_already_refunded';
}

/**
 * Refund a captured Checkout payment that can no longer be fulfilled — the
 * booking was deleted, or cancelled while still pending and never confirmed
 * (a settlement race: the client pays just as the expire-cron / a winery
 * rejection / a session cancellation lands). Without this the charge is
 * stranded on a cancelled/absent booking with no reservation and no refund.
 *
 * Caller MUST have established that the booking is a genuine orphan (missing,
 * or CANCELLED with no `stripePaymentIntentId` — i.e. never confirmed) so a
 * FULFILLED (COMPLETED / NO_SHOW) or already-refunded booking is never clawed
 * back here.
 *
 * Idempotent: keyed on the session id so Stripe collapses redeliveries into a
 * single refund, and an already-refunded charge resolves to `null` instead of
 * throwing — the webhook event must not get stuck FAILED retrying forever.
 * `reverse_transfer` is derived from the session: a gift-funded card charge is
 * a PLATFORM charge with no transfer (ADR-0003) and Stripe rejects
 * reverse_transfer on it.
 */
export async function refundOrphanedCheckoutPayment(
  session: Stripe.Checkout.Session
): Promise<{ refundId: string; amount: number } | null> {
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  if (!paymentIntentId) {
    // A 'paid' session should always carry a PaymentIntent; surface the
    // anomaly distinctly rather than asserting a refund that never happened.
    logError(
      'Orphaned paid session has no PaymentIntent to refund',
      undefined,
      {
        sessionId: session.id,
      }
    );
    return null;
  }

  const giftApplied = Number(session.metadata?.giftAppliedCents ?? '0');
  const isGiftFunded = Number.isFinite(giftApplied) && giftApplied > 0;

  try {
    const refund = await processRefund(
      paymentIntentId,
      true,
      undefined,
      `orphan-refund-${session.id}`,
      { reverseTransfer: !isGiftFunded }
    );
    logError('Refunded orphaned paid checkout session', undefined, {
      sessionId: session.id,
      paymentIntentId,
      refundId: refund.refundId,
      amount: refund.amount,
    });
    return refund;
  } catch (error) {
    if (isAlreadyRefundedError(error)) {
      logInfo('Orphaned session already refunded — no action', {
        sessionId: session.id,
        paymentIntentId,
      });
      return null;
    }
    throw error;
  }
}
