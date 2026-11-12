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

vi.mock('@/server/db', () => {
  const db = {
    booking: {
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    giftCard: {
      findUnique: vi.fn(),
    },
    stripeEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    // "Booking is dead" + "its gift is returned" are one interactive
    // transaction — run the callback on the same mock.
    $transaction: vi.fn(async (callback: (_tx: unknown) => unknown) =>
      callback(db)
    ),
  };
  return { db };
});

vi.mock('@/server/services/giftCard.service', () => ({
  createGiftCardFromPayment: vi.fn(),
  disableGiftCardForPayment: vi.fn(async () => null),
}));

vi.mock('@/server/services/booking-refund.service', () => ({
  syncBookingRefundFromStripe: vi.fn(async () => 'synced'),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock('@/server/services/giftCard-transfer.service', () => ({
  settleGiftTransfer: vi.fn(async () => 'noop'),
}));

vi.mock('@/server/services/giftCard-redemption.service', () => ({
  releaseGiftForBooking: vi.fn(async () => 'noop'),
  releaseGiftForBookingInTx: vi.fn(async () => 'noop'),
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
import { disableGiftCardForPayment } from '@/server/services/giftCard.service';
import { syncBookingRefundFromStripe } from '@/server/services/booking-refund.service';
import {
  releaseGiftForBooking,
  releaseGiftForBookingInTx,
} from '@/server/services/giftCard-redemption.service';
import * as Sentry from '@sentry/nextjs';
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
    // Guarded delete: only removes a still-pending booking on THIS session
    // that was NOT re-claimed meanwhile (its own expiry is not in the future).
    expect(db.booking.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: 'PENDING_PAYMENT',
        AND: [
          {
            OR: [
              { stripeCheckoutSessionId: 'cs_test_current' },
              { stripeCheckoutSessionId: null },
            ],
          },
          {
            OR: [{ expiresAt: null }, { expiresAt: { lte: expect.any(Date) } }],
          },
        ],
      },
    });
    // The gift release rides the SAME transaction as the delete.
    expect(releaseGiftForBookingInTx).toHaveBeenCalledWith(
      expect.anything(),
      'booking-1'
    );
  });

  it('keeps a RE-CLAIMED booking when its previous session expires (retry in flight, hold extended)', async () => {
    const { db } = await import('@/server/db');
    // The client retried after an aborted payment: the action extended the
    // hold (+30 min) and expired the old session, whose webhook lands
    // before the new session id is written — the booking still points at
    // the expired session.
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      id: 'booking-1',
      status: 'PENDING_PAYMENT',
      reference: 'ENC-ABC123',
      stripeCheckoutSessionId: 'cs_test_current',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    } as never);
    mockConstructEvent.mockReturnValue({
      id: 'evt_checkout_expired_reclaimed',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_current',
          metadata: { bookingId: 'booking-1' },
        },
      },
    } as unknown as Stripe.Event);

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    expect(db.booking.deleteMany).not.toHaveBeenCalled();
    expect(releaseGiftForBookingInTx).not.toHaveBeenCalled();
    expect(releaseGiftForBooking).not.toHaveBeenCalled();
  });

  it('still deletes a booking whose own expiry has just passed (natural expiry)', async () => {
    const { db } = await import('@/server/db');
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      id: 'booking-1',
      status: 'PENDING_PAYMENT',
      reference: 'ENC-ABC123',
      stripeCheckoutSessionId: 'cs_test_current',
      expiresAt: new Date(Date.now() - 5_000),
    } as never);
    vi.mocked(db.booking.deleteMany).mockResolvedValue({ count: 1 } as never);
    mockConstructEvent.mockReturnValue({
      id: 'evt_checkout_expired_natural',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_current',
          metadata: { bookingId: 'booking-1' },
        },
      },
    } as unknown as Stripe.Event);

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    expect(db.booking.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('REPLAY-safe: when the booking is already gone, the reserved gift is still returned', async () => {
    const { db } = await import('@/server/db');
    // A previous delivery deleted the row and died before releasing.
    vi.mocked(db.booking.findUnique).mockResolvedValue(null);
    mockConstructEvent.mockReturnValue({
      id: 'evt_checkout_expired_replay',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_current',
          metadata: { bookingId: 'booking-1' },
        },
      },
    } as unknown as Stripe.Event);

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    expect(releaseGiftForBooking).toHaveBeenCalledWith('booking-1');
    expect(db.booking.deleteMany).not.toHaveBeenCalled();
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
    // Released in the same transaction as the cancellation.
    expect(releaseGiftForBookingInTx).toHaveBeenCalledWith(
      expect.anything(),
      'booking-1'
    );
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

  it('REFUNDS a paid session whose amount is not what the booking owes (amount_mismatch)', async () => {
    const session = {
      id: 'cs_test_wrong_amount',
      payment_status: 'paid',
      payment_intent: 'pi_test_wrong_amount',
      amount_total: 4500,
      currency: 'chf',
      metadata: { bookingId: 'booking-1' },
    } as unknown as Stripe.Checkout.Session;
    mockConstructEvent.mockReturnValue({
      id: 'evt_checkout_amount_mismatch',
      type: 'checkout.session.completed',
      data: { object: session },
    } as Stripe.Event);
    mockConfirmBookingFromPaidCheckoutSession.mockResolvedValue({
      result: 'amount_mismatch',
    });

    const response = await POST(createMockRequest());

    expect(response.status).toBe(200);
    expect(refundOrphanedCheckoutPayment).toHaveBeenCalledWith(session);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tags: { area: 'stripe-webhook', incident: 'amount-mismatch' },
      })
    );
  });

  describe('charge.dispute.* — chargebacks', () => {
    const dispute = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'dp_test_1',
        status: 'needs_response',
        reason: 'fraudulent',
        amount: 10250,
        payment_intent: 'pi_test_disputed',
        ...overrides,
      }) as unknown as Stripe.Dispute;

    it('disables the gift card bought with the disputed payment and alerts with the exposure', async () => {
      vi.mocked(disableGiftCardForPayment).mockResolvedValueOnce({
        id: 'gift-1',
        initialAmount: 10000,
        balance: 4000,
        disabledNow: true,
      });
      mockConstructEvent.mockReturnValue({
        id: 'evt_dispute_gift',
        type: 'charge.dispute.created',
        data: { object: dispute() },
      } as unknown as Stripe.Event);

      const response = await POST(createMockRequest());

      expect(response.status).toBe(200);
      expect(disableGiftCardForPayment).toHaveBeenCalledWith(
        'pi_test_disputed',
        'dispute'
      );
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          level: 'error',
          tags: {
            area: 'stripe-webhook',
            incident: 'dispute',
            target: 'gift-card',
          },
          extra: expect.objectContaining({
            giftCardId: 'gift-1',
            // 60.00 already spent before the chargeback.
            redeemedCents: 6000,
            remainingBalanceCents: 4000,
          }),
        })
      );
    });

    it('alerts with the booking reference on a booking dispute — and changes NOTHING on the booking', async () => {
      const { db } = await import('@/server/db');
      vi.mocked(db.booking.findFirst).mockResolvedValueOnce({
        id: 'booking-1',
        reference: 'ENC-DISPUTE1',
        status: 'COMPLETED',
        wineryId: 'winery-1',
        stripePaymentIntentId: 'pi_test_disputed',
      } as never);
      mockConstructEvent.mockReturnValue({
        id: 'evt_dispute_booking',
        type: 'charge.dispute.created',
        data: { object: dispute() },
      } as unknown as Stripe.Event);

      const response = await POST(createMockRequest());

      expect(response.status).toBe(200);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tags: {
            area: 'stripe-webhook',
            incident: 'dispute',
            target: 'booking',
          },
          extra: expect.objectContaining({ bookingRef: 'ENC-DISPUTE1' }),
        })
      );
      expect(db.booking.updateMany).not.toHaveBeenCalled();
      expect(db.booking.deleteMany).not.toHaveBeenCalled();
    });

    it('reports a closed dispute without re-enabling or disabling anything', async () => {
      const { db } = await import('@/server/db');
      vi.mocked(db.giftCard.findUnique).mockResolvedValueOnce({
        id: 'gift-1',
        status: 'DISABLED',
        balance: 4000,
      } as never);
      mockConstructEvent.mockReturnValue({
        id: 'evt_dispute_closed',
        type: 'charge.dispute.closed',
        data: { object: dispute({ status: 'won' }) },
      } as unknown as Stripe.Event);

      const response = await POST(createMockRequest());

      expect(response.status).toBe(200);
      expect(disableGiftCardForPayment).not.toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          level: 'info',
          extra: expect.objectContaining({ action: 'review_reenable' }),
        })
      );
    });
  });

  describe('charge.refunded — refunds made outside the app', () => {
    const charge = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'ch_test_1',
        payment_intent: 'pi_test_refunded',
        amount: 9500,
        amount_refunded: 2000,
        refunded: false,
        ...overrides,
      }) as unknown as Stripe.Charge;

    it('syncs the booking refund ledger with the cumulative Stripe amount', async () => {
      const { db } = await import('@/server/db');
      vi.mocked(db.booking.findFirst).mockResolvedValueOnce({
        id: 'booking-1',
        reference: 'ENC-REFUND01',
      } as never);
      mockConstructEvent.mockReturnValue({
        id: 'evt_charge_refunded',
        type: 'charge.refunded',
        data: { object: charge() },
      } as unknown as Stripe.Event);

      const response = await POST(createMockRequest());

      expect(response.status).toBe(200);
      expect(syncBookingRefundFromStripe).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        cardRefundedCents: 2000,
      });
      expect(disableGiftCardForPayment).not.toHaveBeenCalled();
    });

    it('marks a fully refunded no-show fee as refunded (write-once)', async () => {
      const { db } = await import('@/server/db');
      vi.mocked(db.booking.findFirst)
        .mockResolvedValueOnce(null) // not a booking payment
        .mockResolvedValueOnce({
          id: 'booking-2',
          reference: 'ENC-NOSHOW01',
        } as never);
      vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
      mockConstructEvent.mockReturnValue({
        id: 'evt_charge_refunded_noshow',
        type: 'charge.refunded',
        data: {
          object: charge({
            amount: 3000,
            amount_refunded: 3000,
            refunded: true,
          }),
        },
      } as unknown as Stripe.Event);

      const response = await POST(createMockRequest());

      expect(response.status).toBe(200);
      expect(db.booking.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'booking-2',
          noShowFeeChargeStatus: 'CHARGED',
          noShowFeeRefundId: null,
        },
        data: {
          noShowFeeRefundId: 'stripe:ch_test_1',
          noShowFeeRefundedCents: 3000,
        },
      });
      expect(syncBookingRefundFromStripe).not.toHaveBeenCalled();
    });

    it('disables the gift card when its PURCHASE was fully refunded', async () => {
      const { db } = await import('@/server/db');
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);
      vi.mocked(disableGiftCardForPayment).mockResolvedValueOnce({
        id: 'gift-2',
        initialAmount: 10000,
        balance: 10000,
        disabledNow: true,
      });
      mockConstructEvent.mockReturnValue({
        id: 'evt_charge_refunded_gift',
        type: 'charge.refunded',
        data: {
          object: charge({
            amount: 10250,
            amount_refunded: 10250,
            refunded: true,
          }),
        },
      } as unknown as Stripe.Event);

      const response = await POST(createMockRequest());

      expect(response.status).toBe(200);
      expect(disableGiftCardForPayment).toHaveBeenCalledWith(
        'pi_test_refunded',
        'refund'
      );
    });

    it('leaves a gift card alone on a PARTIAL refund of its purchase', async () => {
      const { db } = await import('@/server/db');
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);
      mockConstructEvent.mockReturnValue({
        id: 'evt_charge_refunded_gift_partial',
        type: 'charge.refunded',
        data: { object: charge({ amount: 10250, amount_refunded: 250 }) },
      } as unknown as Stripe.Event);

      const response = await POST(createMockRequest());

      expect(response.status).toBe(200);
      expect(disableGiftCardForPayment).not.toHaveBeenCalled();
    });
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
