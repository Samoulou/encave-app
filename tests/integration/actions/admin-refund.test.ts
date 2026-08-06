import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus, UserRole } from '@prisma/client';

const { refundsCreateMock } = vi.hoisted(() => ({
  refundsCreateMock: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    winery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminAction: {
      create: vi.fn(),
    },
    // Array form: resolve the already-started promises in order.
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
  isCurrentAdminSessionExpired: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/server/stripe', () => ({
  getStripe: () => ({ refunds: { create: refundsCreateMock } }),
}));

vi.mock('@/server/services/email.service', () => ({
  sendManualRefundClientEmail: vi.fn(),
  sendManualRefundWinemakerEmail: vi.fn(),
  sendWineryApprovedEmail: vi.fn(),
  sendWineryRejectedEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { auth } = await import('@/server/auth');
const { refundBookingManually } = await import('@/server/actions/admin');

const adminSession = {
  user: { id: 'admin-1', role: UserRole.ADMIN },
} as never;

// Never refunded, 4 × 50 CHF + 10.00 fee paid.
const mockBooking = {
  id: 'clbooking0000000000000001',
  reference: 'ENC-ABC12345',
  status: BookingStatus.CONFIRMED,
  totalPrice: 20000,
  serviceFeeCents: 1000,
  refundAmount: null,
  refundIssued: false,
  stripeRefundId: null,
  stripePaymentIntentId: 'pi_test_123',
  visitorName: 'John Doe',
  visitorEmail: 'john@example.com',
  date: new Date('2026-02-15'),
  experience: { title: 'Wine Tasting' },
  winery: {
    email: 'winery@example.com',
    user: { name: 'Marie', preferredLocale: 'fr' },
  },
};

const validInput = {
  bookingId: mockBooking.id,
  amountCents: 10500,
  reason: 'Client complaint — partial goodwill refund',
};

describe('refundBookingManually (résidu Luca B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(adminSession);
    vi.mocked(db.booking.findUnique).mockResolvedValue(mockBooking as never);
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.booking.update).mockResolvedValue({} as never);
    vi.mocked(db.adminAction.create).mockResolvedValue({} as never);
    refundsCreateMock.mockResolvedValue({ id: 're_test_1', amount: 10500 });
  });

  it('rejects non-admin users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', role: UserRole.CLIENT },
    } as never);

    const result = await refundBookingManually(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
    expect(refundsCreateMock).not.toHaveBeenCalled();
  });

  it('caps the refund at what the client actually paid (tickets + fee)', async () => {
    const result = await refundBookingManually({
      ...validInput,
      amountCents: 21001, // paid = 20000 + 1000
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(refundsCreateMock).not.toHaveBeenCalled();
  });

  it('reserves the amount atomically BEFORE calling Stripe', async () => {
    const result = await refundBookingManually(validInput);

    expect(result.success).toBe(true);
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: mockBooking.id,
        refundAmount: null, // exactly the state that was read
        stripeRefundId: null,
      },
      data: { refundAmount: 10500 },
    });
    expect(db.booking.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      refundsCreateMock.mock.invocationCallOrder[0] ?? Infinity
    );
    expect(refundsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_test_123', amount: 10500 }),
      // Fresh key per attempt: a state-derived key would replay Stripe's
      // cached ERROR for 24h on a legitimate retry after a release.
      {
        idempotencyKey: expect.stringMatching(
          new RegExp(`^admin-refund:${mockBooking.id}:`)
        ),
      }
    );
  });

  it('releases the reservation on a rate-limit rejection (nothing processed)', async () => {
    refundsCreateMock.mockRejectedValue({
      type: 'StripeRateLimitError',
      message: 'Too many requests',
    });

    const result = await refundBookingManually(validInput);

    expect(result.success).toBe(false);
    // 429 = Stripe provably processed nothing → headroom given back;
    // keeping it would strand the amount as phantom-refunded forever.
    expect(db.booking.updateMany).toHaveBeenLastCalledWith({
      where: { id: mockBooking.id, refundAmount: 10500 },
      data: { refundAmount: null },
    });
  });

  it('reports success when the refund succeeded but bookkeeping failed', async () => {
    vi.mocked(db.adminAction.create).mockRejectedValueOnce(
      new Error('transient db error')
    );

    const result = await refundBookingManually(validInput);

    // Money moved — telling the admin « failed » would trigger a manual
    // retry and a SECOND real refund (review finding).
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.refundId).toBe('re_test_1');
    }
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: mockBooking.id },
      data: expect.objectContaining({
        stripeRefundId: 're_test_1',
        refundError: expect.stringContaining('BOOKKEEPING_FAILED'),
      }),
    });
  });

  it('backs off with CONFLICT when a concurrent refund won the reservation', async () => {
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 0 } as never);

    const result = await refundBookingManually(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFLICT');
    }
    expect(refundsCreateMock).not.toHaveBeenCalled();
    expect(db.booking.update).not.toHaveBeenCalled();
  });

  it('releases the reservation on a deterministic Stripe rejection', async () => {
    refundsCreateMock.mockRejectedValue({
      type: 'StripeInvalidRequestError',
      message: 'Charge already fully refunded',
    });

    const result = await refundBookingManually(validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('STRIPE_ERROR');
    }
    // Reservation rolled back to the pre-claim value.
    expect(db.booking.updateMany).toHaveBeenLastCalledWith({
      where: { id: mockBooking.id, refundAmount: 10500 },
      data: { refundAmount: null },
    });
    // No refundError written on the deterministic path.
    expect(db.booking.update).not.toHaveBeenCalled();
  });

  it('keeps the reservation and stores refundError on an ambiguous failure', async () => {
    refundsCreateMock.mockRejectedValue(new Error('ECONNRESET'));

    const result = await refundBookingManually(validInput);

    expect(result.success).toBe(false);
    // Only the initial claim — never released (the refund may have gone
    // through; releasing would allow a double refund after key expiry).
    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: mockBooking.id },
      data: { refundError: expect.stringContaining('ECONNRESET') },
    });
  });

  it('marks the booking cancelled on a full refund of the paid total', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...mockBooking,
      refundAmount: 10500,
      stripeRefundId: 're_test_1',
    } as never);
    refundsCreateMock.mockResolvedValue({ id: 're_test_2', amount: 10500 });

    const result = await refundBookingManually({
      ...validInput,
      amountCents: 10500, // 10500 + 10500 = 21000 = paid
    });

    expect(result.success).toBe(true);
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: mockBooking.id,
        refundAmount: 10500,
        stripeRefundId: 're_test_1',
      },
      data: { refundAmount: 21000 },
    });
    expect(db.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refundIssued: true,
          status: BookingStatus.CANCELLED_BY_WINERY,
        }),
      })
    );
  });
});
