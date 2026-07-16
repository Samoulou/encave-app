/**
 * Signed synthetic Stripe webhooks for hermetic e2e (P-16 / L-181).
 *
 * The specs drive the UI up to the fake-session redirect (`E2E_TEST`
 * convention in the checkout/gift/request actions), then POST a
 * `checkout.session.*` event signed with the SAME `STRIPE_WEBHOOK_SECRET`
 * the server verifies — `stripe.webhooks.constructEvent` passes and the
 * REAL webhook code (StripeEvent claim, confirmation, gift minting,
 * request flip) runs. No Stripe network access, no real secret: the value
 * in .env.test is an arbitrary whsec_ shared by both sides.
 */
import type { APIRequestContext, APIResponse } from '@playwright/test';
import Stripe from 'stripe';

// Local-only instance: never talks to the network, only signs payloads.
const stripe = new Stripe('sk_test_e2e_signing_only', {
  apiVersion: '2025-12-15.clover',
});

export interface SyntheticSession {
  /** Session id — default `e2e_sess_{bookingId|rand}` (never cs_-prefixed). */
  id?: string;
  metadata: Record<string, string>;
  paymentIntentId?: string;
  paymentStatus?: 'paid' | 'unpaid';
  customerEmail?: string | null;
}

function sessionObject(input: SyntheticSession) {
  const suffix =
    input.metadata.bookingId ?? Math.random().toString(36).slice(2, 10);
  return {
    id: input.id ?? `e2e_sess_${suffix}`,
    object: 'checkout.session',
    metadata: input.metadata,
    payment_status: input.paymentStatus ?? 'paid',
    payment_intent: input.paymentIntentId ?? `pi_e2e_${suffix}`,
    customer_email: input.customerEmail ?? null,
    customer_details: input.customerEmail
      ? { email: input.customerEmail }
      : null,
    livemode: false,
  };
}

function eventEnvelope(
  type: 'checkout.session.completed' | 'checkout.session.expired',
  session: ReturnType<typeof sessionObject>
) {
  return {
    id: `evt_e2e_${Math.random().toString(36).slice(2, 12)}`,
    object: 'event',
    api_version: '2025-12-15.clover',
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object: session },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  };
}

/**
 * POST a signed checkout webhook to the app. `request` is Playwright's
 * APIRequestContext (page.request) — same origin as the webServer.
 */
export async function postCheckoutWebhook(
  request: APIRequestContext,
  type: 'checkout.session.completed' | 'checkout.session.expired',
  session: SyntheticSession
): Promise<APIResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET missing from the test env');
  }
  const payload = JSON.stringify(eventEnvelope(type, sessionObject(session)));
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return request.post('/api/webhooks/stripe/checkout', {
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    data: payload,
  });
}

/** Confirm a booking exactly like a paid Stripe checkout would. */
export async function confirmBookingViaWebhook(
  request: APIRequestContext,
  input: {
    bookingId: string;
    bookingReference?: string;
    /** Extra metadata (kind: request_offer, giftAppliedCents, …). */
    metadata?: Record<string, string>;
  }
): Promise<APIResponse> {
  return postCheckoutWebhook(request, 'checkout.session.completed', {
    metadata: {
      bookingId: input.bookingId,
      ...(input.bookingReference
        ? { bookingReference: input.bookingReference }
        : {}),
      ...input.metadata,
    },
  });
}

/** Mint a gift card exactly like a paid gift purchase session would. */
export async function mintGiftCardViaWebhook(
  request: APIRequestContext,
  input: {
    amountCents: number;
    purchaserEmail: string;
    purchaserName: string;
    recipientEmail: string;
    recipientName?: string;
    message?: string;
    deliverAt?: Date;
    locale?: string;
  }
): Promise<APIResponse> {
  return postCheckoutWebhook(request, 'checkout.session.completed', {
    customerEmail: input.purchaserEmail,
    metadata: {
      kind: 'gift_card',
      nature: 'AMOUNT',
      amountCents: String(input.amountCents),
      recipientEmail: input.recipientEmail,
      purchaserName: input.purchaserName,
      deliverAt: (input.deliverAt ?? new Date()).toISOString(),
      variant: 'classic',
      locale: input.locale ?? 'fr',
      ...(input.recipientName ? { recipientName: input.recipientName } : {}),
      ...(input.message ? { message: input.message } : {}),
    },
  });
}
