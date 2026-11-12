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
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    stripeEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/giftCard.service', () => ({
  createGiftCardFromPayment: vi.fn(),
}));

vi.mock('@/server/services/giftCard-transfer.service', () => ({
  settleGiftTransfer: vi.fn(async () => 'noop'),
}));

vi.mock('@/server/services/giftCard-redemption.service', () => ({
  releaseGiftForBooking: vi.fn(async () => 'noop'),
}));

// Real Stripe refunds are out of scope here — the route's job is to ROUTE a
// stranded paid session to the orphan-refund path.
vi.mock('@/server/services/payment.service', () => ({
  refundOrphanedCheckoutPayment: vi.fn(async () => ({
    refundId: 're_test_1',
    amount: 9500,
  })),
}));

vi.mock('@/server/services/checkout-confirmation.service', () => ({
  confirmBookingFromPaidCheckoutSession: vi.fn().mockResolvedValue('confirmed'),
}));

import { headers } from 'next/headers';
import { confirmBookingFromPaidCheckoutSession } from '@/server/services/checkout-confirmation.service';
import { refundOrphanedCheckoutPayment } from '@/server/services/payment.service';
import { settleGiftTransfer } from '@/server/services/giftCard-transfer.service';
import { Prisma } from '@prisma/client';

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

  it('deletes the pending booking when ITS session expires', async () => {
    const { db } = await import('@/server/db');
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      id: 'booking-1',
      status: 'PENDING_PAYMENT',
      reference: 'ENC-ABC123',
      stripeCheckoutSessionId: 'cs_test_current',
    } as never);
    vi.mocked(db.booking.deleteMany).mockResolvedValue({ count: 1 } as never);
    const event = {
      id: 'evt_checkout_expired',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_current',
          metadata: { bookingId: 'booking-1' },
        },
      },
    } as unknown as Stripe.Event;
    mockConstructEvent.mockReturnValue(event);

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    // Guarded delete: only removes a still-pending booking on THIS session.
    expect(db.booking.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: 'PENDING_PAYMENT',
        OR: [
          { stripeCheckoutSessionId: 'cs_test_current' },
          { stripeCheckoutSessionId: null },
        ],
      },
    });
  });

  it('keeps the booking when a STALE session expires (retry created a newer one)', async () => {
    const { db } = await import('@/server/db');
    // The booking now points at the retry's session — the old session's
    // expiry must not destroy a booking being paid (P-04 review finding).
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      id: 'booking-1',
      status: 'PENDING_PAYMENT',
      reference: 'ENC-ABC123',
      stripeCheckoutSessionId: 'cs_test_newer',
    } as never);
    const event = {
      id: 'evt_checkout_expired_stale',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_stale',
          metadata: { bookingId: 'booking-1' },
        },
      },
    } as unknown as Stripe.Event;
    mockConstructEvent.mockReturnValue(event);

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    expect(db.booking.delete).not.toHaveBeenCalled();
  });

  it('cancels the pending booking when its async payment fails (delayed TWINT)', async () => {
    const { db } = await import('@/server/db');
    const { releaseGiftForBooking } =
      await import('@/server/services/giftCard-redemption.service');
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      id: 'booking-1',
      status: 'PENDING_PAYMENT',
      reference: 'ENC-ABC123',
      stripeCheckoutSessionId: 'cs_test_current',
    } as never);
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
    const event = {
      id: 'evt_checkout_async_failed',
      type: 'checkout.session.async_payment_failed',
      data: {
        object: {
          id: 'cs_test_current',
          metadata: { bookingId: 'booking-1' },
        },
      },
    } as unknown as Stripe.Event;
    mockConstructEvent.mockReturnValue(event);

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: 'PENDING_PAYMENT',
        OR: [
          { stripeCheckoutSessionId: 'cs_test_current' },
          { stripeCheckoutSessionId: null },
        ],
      },
      data: {
        status: 'CANCELLED_BY_CLIENT',
        cancelledAt: expect.any(Date),
        cancellationReason: 'PAYMENT_FAILED',
      },
    });
    expect(releaseGiftForBooking).toHaveBeenCalledWith('booking-1');
  });

  it('keeps the booking when a STALE session fails async payment (retry created a newer one)', async () => {
    const { db } = await import('@/server/db');
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      id: 'booking-1',
      status: 'PENDING_PAYMENT',
      reference: 'ENC-ABC123',
      stripeCheckoutSessionId: 'cs_test_newer',
    } as never);
    const event = {
      id: 'evt_checkout_async_failed_stale',
      type: 'checkout.session.async_payment_failed',
      data: {
        object: {
          id: 'cs_test_stale',
          metadata: { bookingId: 'booking-1' },
        },
      },
    } as unknown as Stripe.Event;
    mockConstructEvent.mockReturnValue(event);

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it('REFUNDS a paid session that is not the booking current session (never a silent ack)', async () => {
    // A superseded session got paid: the booking points at a newer one (or
    // was already confirmed on another). Money was taken → it must go back.
    const session = {
      id: 'cs_test_superseded',
      payment_status: 'paid',
      payment_intent: 'pi_test_superseded',
      amount_total: 9500,
      // Gift metadata present: the transfer must NOT be settled on a
      // session the booking no longer points at.
      metadata: { bookingId: 'booking-1', giftAppliedCents: '5000' },
    } as unknown as Stripe.Checkout.Session;
    mockConstructEvent.mockReturnValue({
      id: 'evt_checkout_mismatch',
      type: 'checkout.session.completed',
      data: { object: session },
    } as Stripe.Event);
    mockConfirmBookingFromPaidCheckoutSession.mockResolvedValue({
      result: 'session_mismatch',
    });

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    expect(refundOrphanedCheckoutPayment).toHaveBeenCalledTimes(1);
    expect(refundOrphanedCheckoutPayment).toHaveBeenCalledWith(session);
    expect(settleGiftTransfer).not.toHaveBeenCalled();
  });

  it('REFUNDS a sur-mesure offer paid on a superseded session (second tab / device)', async () => {
    const session = {
      id: 'cs_test_offer_old',
      payment_status: 'paid',
      payment_intent: 'pi_test_offer_old',
      amount_total: 120000,
      metadata: {
        kind: 'request_offer',
        bookingId: 'booking-1',
        requestOfferId: 'offer-1',
      },
    } as unknown as Stripe.Checkout.Session;
    mockConstructEvent.mockReturnValue({
      id: 'evt_offer_mismatch',
      type: 'checkout.session.completed',
      data: { object: session },
    } as Stripe.Event);
    mockConfirmBookingFromPaidCheckoutSession.mockResolvedValue({
      result: 'session_mismatch',
    });

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    expect(refundOrphanedCheckoutPayment).toHaveBeenCalledWith(session);
  });

  it('a failed mismatch refund fails the event (500) so Stripe redelivers it', async () => {
    const { db } = await import('@/server/db');
    const session = {
      id: 'cs_test_superseded',
      payment_status: 'paid',
      payment_intent: 'pi_test_superseded',
      metadata: { bookingId: 'booking-1' },
    } as unknown as Stripe.Checkout.Session;
    mockConstructEvent.mockReturnValue({
      id: 'evt_checkout_mismatch_fail',
      type: 'checkout.session.completed',
      data: { object: session },
    } as Stripe.Event);
    mockConfirmBookingFromPaidCheckoutSession.mockResolvedValue({
      result: 'session_mismatch',
    });
    vi.mocked(refundOrphanedCheckoutPayment).mockRejectedValueOnce(
      new Error('Stripe unavailable')
    );

    const response = await POST(createMockRequest());

    expect(response.status).toBe(500);
    expect(db.stripeEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      })
    );
  });

  describe('redelivery while the event row already exists', () => {
    const duplicateKey = () =>
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      });
    const paidEvent = {
      id: 'evt_redelivered',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_paid',
          payment_status: 'paid',
          payment_intent: 'pi_test_123',
          metadata: { bookingId: 'booking-1' },
        },
      },
    } as unknown as Stripe.Event;

    it('answers 409 (NOT 2xx) while another delivery is still PROCESSING — Stripe must keep retrying', async () => {
      const { db } = await import('@/server/db');
      mockConstructEvent.mockReturnValue(paidEvent);
      vi.mocked(db.stripeEvent.create).mockRejectedValueOnce(duplicateKey());
      vi.mocked(db.stripeEvent.findUnique).mockResolvedValueOnce({
        status: 'PROCESSING',
      } as never);
      // Not stale: the reclaim CAS matches nothing.
      vi.mocked(db.stripeEvent.updateMany).mockResolvedValueOnce({
        count: 0,
      } as never);

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.duplicate).toBeUndefined();
      expect(mockConfirmBookingFromPaidCheckoutSession).not.toHaveBeenCalled();
    });

    it('reclaims a STALE PROCESSING row and processes the event', async () => {
      const { db } = await import('@/server/db');
      mockConstructEvent.mockReturnValue(paidEvent);
      vi.mocked(db.stripeEvent.create).mockRejectedValueOnce(duplicateKey());
      vi.mocked(db.stripeEvent.findUnique).mockResolvedValueOnce({
        status: 'PROCESSING',
      } as never);
      vi.mocked(db.stripeEvent.updateMany).mockResolvedValueOnce({
        count: 1,
      } as never);

      const response = await POST(createMockRequest());

      expect(response.status).toBe(200);
      expect(mockConfirmBookingFromPaidCheckoutSession).toHaveBeenCalledTimes(
        1
      );
    });

    it('acknowledges an already PROCESSED event with 200 duplicate', async () => {
      const { db } = await import('@/server/db');
      mockConstructEvent.mockReturnValue(paidEvent);
      vi.mocked(db.stripeEvent.create).mockRejectedValueOnce(duplicateKey());
      vi.mocked(db.stripeEvent.findUnique).mockResolvedValueOnce({
        status: 'PROCESSED',
      } as never);

      const response = await POST(createMockRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.duplicate).toBe(true);
      expect(mockConfirmBookingFromPaidCheckoutSession).not.toHaveBeenCalled();
    });
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
