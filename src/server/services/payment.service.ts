import type Stripe from 'stripe';
import { getStripe } from '@/server/stripe';
import { db } from '@/server/db';
import { env, getBaseUrl } from '@/lib/env';

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
 * Handles both full and partial refunds, including application fee refund
 */
export async function processRefund(
  stripePaymentIntentOrSessionId: string,
  refundApplicationFee: boolean = true
): Promise<{ refundId: string; amount: number }> {
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

  const refund = await getStripe().refunds.create({
    payment_intent: paymentIntentId,
    reverse_transfer: true,
    refund_application_fee: refundApplicationFee,
  });

  return {
    refundId: refund.id,
    amount: refund.amount,
  };
}
