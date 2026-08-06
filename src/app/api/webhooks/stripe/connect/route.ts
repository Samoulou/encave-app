import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, isStripeConfigured } from '@/server/stripe';
import { db } from '@/server/db';
import { env } from '@/lib/env';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { invalidateWineryCaches } from '@/server/actions/winery-helpers';
import {
  claimStripeEvent,
  markStripeEventFailed,
  markStripeEventProcessed,
} from '@/server/services/stripe-event.service';
import { sendStripeActionRequiredEmail } from '@/server/services/email.service';
import {
  logEmailSent,
  logEmailFailed,
} from '@/server/services/email-log.service';
import {
  computeStripeDueHash,
  shouldNotifyStripeAction,
} from '@/lib/business-rules/stripe-action-email';

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
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logError('Webhook signature verification failed', err);
    return NextResponse.json(
      {
        error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      { status: 400 }
    );
  }

  const shouldProcess = await claimStripeEvent(event);
  if (!shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true });
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

    await markStripeEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    logError('Error processing webhook', error);
    await markStripeEventFailed(event.id, error);
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
    select: {
      id: true,
      slug: true,
      email: true,
      stripeActionDueHash: true,
      stripeActionEmailAt: true,
      user: { select: { name: true, preferredLocale: true } },
    },
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

  // KYC flip via Stripe Connect impacts ENC-027 visibility criterion 2.
  invalidateWineryCaches(winery.slug);

  logInfo('Updated winery Stripe status', {
    wineryId: winery.id,
    detailsSubmitted: account.details_submitted,
    chargesEnabled: account.charges_enabled,
  });

  await maybeSendActionRequiredEmail(account, {
    wineryId: winery.id,
    email: winery.email,
    firstName: winery.user.name || 'Winemaker',
    preferredLocale: winery.user.preferredLocale,
    storedHash: winery.stripeActionDueHash,
    lastEmailAt: winery.stripeActionEmailAt,
  });
}

/**
 * Email #18 « Action requise Stripe » (P-13 / L-143). account.updated
 * fires on every account touch, so the send is gated by
 * shouldNotifyStripeAction (requirements changed, or 7-day re-reminder).
 * Fail-safe: any error here is logged and swallowed — the status update
 * above must never be retried by Stripe because of an email problem.
 */
async function maybeSendActionRequiredEmail(
  account: Stripe.Account,
  winery: {
    wineryId: string;
    email: string;
    firstName: string;
    preferredLocale: 'FR' | 'DE' | 'EN' | null;
    storedHash: string | null;
    lastEmailAt: Date | null;
  }
) {
  try {
    const currentlyDue = account.requirements?.currently_due ?? [];

    if (currentlyDue.length === 0) {
      // Resolved: clear the fingerprint so a future regression notifies
      // again immediately.
      if (winery.storedHash !== null) {
        await db.winery.update({
          where: { id: winery.wineryId },
          data: { stripeActionDueHash: null },
        });
      }
      return;
    }

    if (
      !shouldNotifyStripeAction({
        currentlyDue,
        storedHash: winery.storedHash,
        lastEmailAt: winery.lastEmailAt,
        now: new Date(),
      })
    ) {
      return;
    }

    const success = await sendStripeActionRequiredEmail(
      winery.email,
      { firstName: winery.firstName, currentlyDue },
      winery.preferredLocale
    );

    if (success) {
      await db.winery.update({
        where: { id: winery.wineryId },
        data: {
          stripeActionDueHash: computeStripeDueHash(currentlyDue),
          stripeActionEmailAt: new Date(),
        },
      });
      await logEmailSent('stripe_action_required', winery.wineryId);
      logInfo('Stripe action-required email sent', {
        wineryId: winery.wineryId,
        dueCount: currentlyDue.length,
      });
    } else {
      // Columns NOT updated → the next account.updated retries the send.
      await logEmailFailed(
        'stripe_action_required',
        winery.wineryId,
        'Failed to send'
      );
    }
  } catch (error) {
    logError('Stripe action-required email failed', error, {
      action: 'handleAccountUpdated',
      wineryId: winery.wineryId,
    });
  }
}

/**
 * Handle account.application.deauthorized events
 * When a winemaker disconnects their Stripe account
 */
async function handleAccountDeauthorized(stripeAccountId: string) {
  // Find the winery with this Stripe account
  const winery = await db.winery.findUnique({
    where: { stripeAccountId },
    select: { id: true, slug: true },
  });

  if (!winery) {
    logWarn('No winery found for deauthorized Stripe account', {
      stripeAccountId,
    });
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

  // Deauthorization flips KYC off → winery should leave public listings.
  invalidateWineryCaches(winery.slug);

  logInfo('Winery Stripe account deauthorized', { wineryId: winery.id });
}
