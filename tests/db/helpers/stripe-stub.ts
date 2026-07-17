/**
 * Stripe stub for tests/db suites: REAL signature crypto (webhooks
 * namespace of an offline Stripe instance) + vi.fn network surface, so a
 * suite can drive the real route/service code against the real database
 * while asserting exactly which Stripe calls were made.
 *
 * Usage in a test file (the factory must run at module scope, BEFORE the
 * dynamic imports of app modules in beforeAll — same lazy-factory pattern
 * as tasting-loop.test.ts):
 *
 *   const stripeStub = makeStripeStub();
 *   vi.mock('@/server/stripe', () => ({
 *     isStripeConfigured: () => true,
 *     getStripe: () => stripeStub.client,
 *   }));
 */
import { vi } from 'vitest';
import Stripe from 'stripe';

// Offline instance: only its `webhooks` (constructEvent) is exposed.
const signatureOnly = new Stripe('sk_test_db_stub_never_network', {
  apiVersion: '2025-12-15.clover',
});

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_dbstub_${seq}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeStripeStub() {
  const fns = {
    sessionsCreate: vi.fn(async () => ({
      id: nextId('cs'),
      url: 'https://checkout.stripe.com/pay/dbstub',
    })),
    sessionsRetrieve: vi.fn(async (id: string) => ({
      id,
      payment_status: 'unpaid',
      status: 'open',
    })),
    sessionsExpire: vi.fn(async (id: string) => ({ id, status: 'expired' })),
    transfersCreate: vi.fn(async () => ({ id: nextId('tr') })),
    transfersCreateReversal: vi.fn(async () => ({ id: nextId('trr') })),
    refundsCreate: vi.fn(async () => ({
      id: nextId('re'),
      status: 'succeeded',
    })),
    paymentIntentsCreate: vi.fn(async () => ({
      id: nextId('pi'),
      status: 'succeeded',
    })),
    setupIntentsRetrieve: vi.fn(async (id: string) => ({
      id,
      status: 'succeeded',
      payment_method: 'pm_dbstub',
      customer: 'cus_dbstub',
    })),
  };

  const client = {
    webhooks: signatureOnly.webhooks,
    checkout: {
      sessions: {
        create: fns.sessionsCreate,
        retrieve: fns.sessionsRetrieve,
        expire: fns.sessionsExpire,
      },
    },
    transfers: {
      create: fns.transfersCreate,
      createReversal: fns.transfersCreateReversal,
    },
    refunds: { create: fns.refundsCreate },
    // paymentIntents.retrieve is deliberately absent: the app never calls
    // it — an undefined member is a louder failure than a silent stub.
    paymentIntents: { create: fns.paymentIntentsCreate },
    setupIntents: { retrieve: fns.setupIntentsRetrieve },
  };

  return { client, fns };
}

export type StripeStub = ReturnType<typeof makeStripeStub>;
