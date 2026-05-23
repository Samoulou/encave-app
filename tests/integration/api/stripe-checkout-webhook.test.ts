import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_checkout_mock',
  },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const mockConstructEvent = vi.fn();
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  })),
}));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    stripeEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/checkout-confirmation.service', () => ({
  confirmBookingFromPaidCheckoutSession: vi.fn().mockResolvedValue('confirmed'),
}));

import { headers } from 'next/headers';
import { confirmBookingFromPaidCheckoutSession } from '@/server/services/checkout-confirmation.service';

const { POST } = await import('@/app/api/webhooks/stripe/checkout/route');

const mockHeaders = vi.mocked(headers);
const mockConfirmBookingFromPaidCheckoutSession = vi.mocked(
  confirmBookingFromPaidCheckoutSession
);

function createMockRequest(body = '{}'): Request {
  return {
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

function createMockHeaders(signature: string | null) {
  return {
    get: vi.fn((name: string) =>
      name === 'stripe-signature' ? signature : null
    ),
  };
}

describe('Stripe checkout webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(
      createMockHeaders('valid_signature') as never
    );
    mockConfirmBookingFromPaidCheckoutSession.mockResolvedValue('confirmed');
  });

  it('dispatches checkout.session.completed to the paid checkout confirmation service', async () => {
    const session = {
      id: 'cs_test_paid',
      payment_status: 'paid',
      payment_intent: 'pi_test_123',
      metadata: { bookingId: 'booking-1' },
    } as Stripe.Checkout.Session;
    const event = {
      id: 'evt_checkout_completed',
      type: 'checkout.session.completed',
      data: { object: session },
    } as Stripe.Event;
    mockConstructEvent.mockReturnValue(event);

    const response = await POST(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockConfirmBookingFromPaidCheckoutSession).toHaveBeenCalledWith(
      session,
      'webhook'
    );
  });

  it('returns 400 when the Stripe signature is missing', async () => {
    mockHeaders.mockResolvedValue(createMockHeaders(null) as never);

    const response = await POST(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing signature');
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it('returns 400 when Stripe signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const response = await POST(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Webhook Error');
    expect(mockConfirmBookingFromPaidCheckoutSession).not.toHaveBeenCalled();
  });
});
