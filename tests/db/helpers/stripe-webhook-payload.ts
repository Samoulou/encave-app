/**
 * Signed synthetic Stripe checkout events for the tests/db route-level
 * suites — the Vitest twin of tests/e2e/utils/stripe-webhook.ts (which is
 * Playwright-bound). The payload is signed with the SAME secret the route
 * verifies, so `stripe.webhooks.constructEvent` passes and the REAL
 * webhook code (StripeEvent claim, confirmation, gift minting, request
 * flip) runs. No network access: this Stripe instance only signs.
 */
import Stripe from 'stripe';

// Local-only instance: never talks to the network, only signs payloads.
const signer = new Stripe('sk_test_db_signing_only', {
  apiVersion: '2025-12-15.clover',
});

export type CheckoutEventType =
  | 'checkout.session.completed'
  | 'checkout.session.async_payment_succeeded'
  | 'checkout.session.expired';

export interface SyntheticSession {
  /** Session id — default `dbtest_sess_{bookingId|rand}` (never cs_-prefixed). */
  id?: string;
  metadata: Record<string, string>;
  paymentIntentId?: string;
  paymentStatus?: 'paid' | 'unpaid' | 'no_payment_required';
  customerEmail?: string | null;
  /** mode:'setup' sessions (no-show imprint) carry a setup_intent instead. */
  setupIntentId?: string;
}

export function sessionObject(input: SyntheticSession) {
  const suffix =
    input.metadata.bookingId ?? Math.random().toString(36).slice(2, 10);
  return {
    id: input.id ?? `dbtest_sess_${suffix}`,
    object: 'checkout.session',
    metadata: input.metadata,
    payment_status: input.paymentStatus ?? 'paid',
    payment_intent: input.setupIntentId
      ? null
      : (input.paymentIntentId ?? `pi_dbtest_${suffix}`),
    setup_intent: input.setupIntentId ?? null,
    customer_email: input.customerEmail ?? null,
    customer_details: input.customerEmail
      ? { email: input.customerEmail }
      : null,
    livemode: false,
  };
}

export interface SignedEvent {
  /** JSON body to POST verbatim. */
  payload: string;
  /** Value for the `stripe-signature` header. */
  signature: string;
  /** The event id — reuse it to simulate a Stripe redelivery. */
  eventId: string;
}

/**
 * Builds a signed webhook delivery. Pass the same `eventId` twice to
 * simulate a Stripe redelivery of the SAME event (idempotence tests);
 * omit it for a fresh event. Non-checkout event types (`string & {}`
 * keeps autocomplete on the three checkout literals) carry `dataObject`
 * instead of a session — e.g. a `charge.refunded` the route ignores.
 */
export function buildSignedCheckoutEvent(
  input: {
    secret: string;
    eventId?: string;
  } & (
    | { type: CheckoutEventType; session: SyntheticSession }
    | { type: string & {}; dataObject: Record<string, unknown> }
  )
): SignedEvent {
  const eventId =
    input.eventId ?? `evt_dbtest_${Math.random().toString(36).slice(2, 12)}`;
  const payload = JSON.stringify({
    id: eventId,
    object: 'event',
    api_version: '2025-12-15.clover',
    created: Math.floor(Date.now() / 1000),
    type: input.type,
    data: {
      object:
        'session' in input ? sessionObject(input.session) : input.dataObject,
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
  });
  const signature = signer.webhooks.generateTestHeaderString({
    payload,
    secret: input.secret,
  });
  return { payload, signature, eventId };
}

/**
 * Builds the `Request` the route handler expects. The `stripe-signature`
 * header must ALSO be exposed through the test's `next/headers` mock —
 * the route reads `headers()` (request context), not `req.headers`.
 */
export function webhookRequest(event: SignedEvent): Request {
  return new Request('http://localhost/api/webhooks/stripe/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: event.payload,
  });
}
