import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, isStripeConfigured } from '@/server/stripe';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { logError, logInfo, logWarn } from '@/lib/logger';

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    logError('Stripe is not configured');
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    );
  }
  const stripe = getStripe();

  const webhookSecret = env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logError('STRIPE_CONNECT_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    logError('Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logError('Webhook signature verification failed', err);
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 400 }
    );
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      case 'account.application.deauthorized': {
        // The account ID comes from the event metadata
        if ('account' in event && typeof event.account === 'string') {
          await handleAccountDeauthorized(event.account);
        }
        break;
      }

      default:
        // Unexpected event type - log but don't fail
        logInfo('Unhandled event type', { eventType: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logError('Error processing webhook', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle account.updated events
 * Updates winery Stripe status fields based on account status
 */
async function handleAccountUpdated(account: Stripe.Account) {
  const stripeAccountId = account.id;

  // Find the winery with this Stripe account
  const winery = await db.winery.findUnique({
    where: { stripeAccountId },
    select: { id: true },
  });

  if (!winery) {
    logWarn('No winery found for Stripe account', { stripeAccountId });
    return;
  }

  // Update winery with latest Stripe status
  await db.winery.update({
    where: { stripeAccountId },
    data: {
      stripeDetailsSubmitted: account.details_submitted,
      stripeOnboardingComplete: account.charges_enabled,
    },
  });

  logInfo('Updated winery Stripe status', {
    wineryId: winery.id,
    detailsSubmitted: account.details_submitted,
    chargesEnabled: account.charges_enabled,
  });
}

/**
 * Handle account.application.deauthorized events
 * When a winemaker disconnects their Stripe account
 */
async function handleAccountDeauthorized(stripeAccountId: string) {
  // Find the winery with this Stripe account
  const winery = await db.winery.findUnique({
    where: { stripeAccountId },
    select: { id: true },
  });

  if (!winery) {
    logWarn('No winery found for deauthorized Stripe account', { stripeAccountId });
    return;
  }

  // Reset Stripe fields (account is now disconnected)
  await db.winery.update({
    where: { stripeAccountId },
    data: {
      stripeAccountId: null,
      stripeDetailsSubmitted: false,
      stripeOnboardingComplete: false,
    },
  });

  logInfo('Winery Stripe account deauthorized', { wineryId: winery.id });
}
