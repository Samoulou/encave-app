import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus } from '@prisma/client';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/server/stripe', () => ({
  getStripe: vi.fn(),
  isStripeConfigured: vi.fn(() => true),
}));

vi.mock('@/server/services/rate-limit.service', () => ({
  checkRateLimit: vi.fn(async () => ({
    success: true,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  })),
}));

vi.mock('@/server/services/booking-confirmation.service', () => ({
  confirmBookingFromCheckoutSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '127.0.0.1' })),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { getStripe } from '@/server/stripe';
import { confirmBookingFromCheckoutSession } from '@/server/services/booking-confirmation.service';
import { reconcileBookingPayment } from '@/server/actions/booking/reconcileBookingPayment';

const BOOKING_ID = 'ckxyzabcdefghij1234567890';
const SESSION_ID = 'cs_test_abc123def456';
const PI_ID = 'pi_test_xyz789';

const sessionOwner: Session = {
  user: {
    id: 'user-1',
    email: 'jane@example.com',
    emailVerified: true,
    name: 'Jane',
    role: 'CLIENT',
    preferredLocale: 'FR',
  },
};

const sessionOwnerUnverified: Session = {
  user: {
    id: 'user-2',
    email: 'jane@example.com',
    emailVerified: false,
    name: 'Jane unverified',
    role: 'CLIENT',
    preferredLocale: 'FR',
  },
};

const pendingBooking = {
  id: BOOKING_ID,
  status: BookingStatus.PENDING_PAYMENT,
  stripePaymentIntentId: SESSION_ID, // sessionId-as-capability also covered
  visitorEmail: 'jane@example.com',
  accessTokenHash: null,
};

function mockStripeRetrieve(session: Record<string, unknown>) {
  vi.mocked(getStripe).mockReturnValue({
    checkout: {
      sessions: {
        retrieve: vi.fn().mockResolvedValue(session),
      },
    },
  } as unknown as ReturnType<typeof getStripe>);
}

describe('reconcileBookingPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns CONFIRMED when Stripe says paid and service flips the row', async () => {
    vi.mocked(auth).mockResolvedValue(sessionOwner);
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      pendingBooking as unknown as Awaited<
        ReturnType<typeof db.booking.findUnique>
      >
    );
    mockStripeRetrieve({
      id: SESSION_ID,
      status: 'complete',
      payment_status: 'paid',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      payment_intent: { id: PI_ID },
      metadata: { bookingId: BOOKING_ID },
    });
    vi.mocked(confirmBookingFromCheckoutSession).mockResolvedValue({
      confirmed: true,
      alreadyConfirmed: false,
    });

    const result = await reconcileBookingPayment({
      bookingId: BOOKING_ID,
      sessionId: SESSION_ID,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('unreachable');
    expect(result.data).toEqual({ kind: 'CONFIRMED', bookingId: BOOKING_ID });
    expect(confirmBookingFromCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'RECONCILE' })
    );
  });

  it('returns ALREADY_CONFIRMED without calling Stripe when booking is already CONFIRMED', async () => {
    vi.mocked(auth).mockResolvedValue(sessionOwner);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...pendingBooking,
      status: BookingStatus.CONFIRMED,
    } as unknown as Awaited<ReturnType<typeof db.booking.findUnique>>);

    const getStripeMock = vi.fn();
    vi.mocked(getStripe).mockImplementation(getStripeMock);

    const result = await reconcileBookingPayment({
      bookingId: BOOKING_ID,
      sessionId: SESSION_ID,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('unreachable');
    expect(result.data).toEqual({
      kind: 'ALREADY_CONFIRMED',
      bookingId: BOOKING_ID,
    });
    expect(getStripeMock).not.toHaveBeenCalled();
  });

  it('returns ALREADY_CANCELLED when booking is in a terminal cancelled state', async () => {
    vi.mocked(auth).mockResolvedValue(sessionOwner);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...pendingBooking,
      status: BookingStatus.CANCELLED_BY_CLIENT,
    } as unknown as Awaited<ReturnType<typeof db.booking.findUnique>>);

    const result = await reconcileBookingPayment({
      bookingId: BOOKING_ID,
      sessionId: SESSION_ID,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('unreachable');
    expect(result.data).toEqual({
      kind: 'ALREADY_CANCELLED',
      bookingId: BOOKING_ID,
      status: BookingStatus.CANCELLED_BY_CLIENT,
    });
  });

  it('returns PAYMENT_FAILED_INSTANT when Stripe says unpaid (card declined)', async () => {
    vi.mocked(auth).mockResolvedValue(sessionOwner);
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      pendingBooking as unknown as Awaited<
        ReturnType<typeof db.booking.findUnique>
      >
    );
    mockStripeRetrieve({
      id: SESSION_ID,
      status: 'open',
      payment_status: 'unpaid',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      payment_intent: { id: PI_ID, status: 'requires_payment_method' },
      metadata: { bookingId: BOOKING_ID },
    });

    const result = await reconcileBookingPayment({
      bookingId: BOOKING_ID,
      sessionId: SESSION_ID,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('unreachable');
    expect(result.data).toEqual({ kind: 'PAYMENT_FAILED_INSTANT' });
    expect(confirmBookingFromCheckoutSession).not.toHaveBeenCalled();
  });

  it('H2: rejects level-1 auth when the session email is not verified', async () => {
    // Email match but emailVerified=false → level 1 must fail. With no token
    // and stripePaymentIntentId mismatching, level 2 and 3 also fail → FORBIDDEN.
    vi.mocked(auth).mockResolvedValue(sessionOwnerUnverified);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...pendingBooking,
      stripePaymentIntentId: 'cs_other_session',
    } as unknown as Awaited<ReturnType<typeof db.booking.findUnique>>);

    const result = await reconcileBookingPayment({
      bookingId: BOOKING_ID,
      sessionId: SESSION_ID,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('unreachable');
    expect(result.error.code).toBe('FORBIDDEN');
  });

  it('H3: rejects level-3 auth when stripePaymentIntentId is a pi_ (not cs_) value', async () => {
    // The validator forces `sessionId` to start with `cs_`, so the attack
    // surface for H3 is: DB row has a `pi_...` (e.g. webhook already wrote
    // the payment intent id) but caller sends a colliding sessionId.
    // Level 3 must NOT accept it — the policy requires booking field to
    // start with `cs_`.
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...pendingBooking,
      stripePaymentIntentId: 'pi_should_not_match',
    } as unknown as Awaited<ReturnType<typeof db.booking.findUnique>>);

    const result = await reconcileBookingPayment({
      bookingId: BOOKING_ID,
      sessionId: SESSION_ID, // valid `cs_test_...` shape per validator
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('unreachable');
    expect(result.error.code).toBe('FORBIDDEN');
  });

  it('returns SESSION_EXPIRED when the Stripe session is past its expires_at', async () => {
    vi.mocked(auth).mockResolvedValue(sessionOwner);
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      pendingBooking as unknown as Awaited<
        ReturnType<typeof db.booking.findUnique>
      >
    );
    mockStripeRetrieve({
      id: SESSION_ID,
      status: 'expired',
      payment_status: 'unpaid',
      expires_at: Math.floor(Date.now() / 1000) - 60,
      payment_intent: null,
      metadata: { bookingId: BOOKING_ID },
    });

    const result = await reconcileBookingPayment({
      bookingId: BOOKING_ID,
      sessionId: SESSION_ID,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('unreachable');
    expect(result.data).toEqual({ kind: 'SESSION_EXPIRED' });
    expect(confirmBookingFromCheckoutSession).not.toHaveBeenCalled();
  });
});
