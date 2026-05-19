import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, Locale } from '@prisma/client';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminAction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (operations: unknown[]) => operations),
  },
}));

const refundCreateMock = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({
    refunds: { create: refundCreateMock },
  }),
}));

vi.mock('@/server/services/email.service', () => ({
  sendManualRefundClientEmail: vi.fn().mockResolvedValue(true),
  sendManualRefundWinemakerEmail: vi.fn().mockResolvedValue(true),
  sendWineryApprovedEmail: vi.fn(),
  sendWineryRejectedEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { sendManualRefundClientEmail, sendManualRefundWinemakerEmail } =
  await import('@/server/services/email.service');
const { refundBookingManually } = await import('@/server/actions/admin');

const adminSession: Session = {
  user: {
    id: 'admin-1',
    email: 'admin@test.ch',
    name: 'Admin',
    role: 'ADMIN',
    preferredLocale: Locale.FR,
  },
};

const bookingId = 'ckmanualrefund123456789012345';

function booking(overrides: Partial<ReturnType<typeof baseBooking>> = {}) {
  return { ...baseBooking(), ...overrides };
}

function baseBooking() {
  return {
    id: bookingId,
    reference: 'ENC-REFUND',
    status: BookingStatus.CONFIRMED,
    visitorName: 'Alice Client',
    visitorEmail: 'alice@test.ch',
    date: new Date('2026-06-15T00:00:00.000Z'),
    totalPrice: 10000,
    refundAmount: 0,
    refundIssued: false,
    stripePaymentIntentId: 'pi_test_123',
    experience: { title: 'Atelier pinot' },
    winery: {
      email: 'owner@test.ch',
      user: { name: 'Owner', preferredLocale: Locale.FR },
    },
  };
}

describe('refundBookingManually', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(adminSession);
    refundCreateMock.mockResolvedValue({ id: 're_test_123' });
    vi.mocked(db.booking.update).mockResolvedValue({} as never);
    vi.mocked(db.adminAction.create).mockResolvedValue({} as never);
  });

  it('records a partial refund without cancelling the booking', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(booking());

    const result = await refundBookingManually({
      bookingId,
      amountCents: 4000,
      reason: 'Client support partial refund',
    });

    expect(result.success).toBe(true);
    expect(refundCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4000, payment_intent: 'pi_test_123' }),
      expect.objectContaining({
        idempotencyKey: `admin-refund:${bookingId}:0:4000`,
      })
    );
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: bookingId },
      data: expect.objectContaining({
        refundIssued: false,
        refundAmount: 4000,
        stripeRefundId: 're_test_123',
      }),
    });
    expect(db.adminAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'REFUND_BOOKING',
        metadata: expect.objectContaining({ type: 'PARTIAL' }),
      }),
    });
    expect(sendManualRefundClientEmail).toHaveBeenCalled();
    expect(sendManualRefundWinemakerEmail).toHaveBeenCalled();
  });

  it('cancels the booking on full refund', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(booking());

    const result = await refundBookingManually({
      bookingId,
      amountCents: 10000,
      reason: 'Client support full refund',
    });

    expect(result.success).toBe(true);
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: bookingId },
      data: expect.objectContaining({
        refundIssued: true,
        refundAmount: 10000,
        status: BookingStatus.CANCELLED_BY_WINERY,
        cancellationReason: 'ADMIN_REFUND',
      }),
    });
  });

  it('blocks a double refund when the booking is already fully refunded', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      booking({ refundAmount: 10000, refundIssued: true })
    );

    const result = await refundBookingManually({
      bookingId,
      amountCents: 1000,
      reason: 'Duplicate refund attempt',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(refundCreateMock).not.toHaveBeenCalled();
  });

  it('logs failed Stripe refunds and stores refundError', async () => {
    vi.mocked(db.booking.findUnique).mockResolvedValue(booking());
    refundCreateMock.mockRejectedValue(new Error('Stripe down'));

    const result = await refundBookingManually({
      bookingId,
      amountCents: 10000,
      reason: 'Client support full refund',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('STRIPE_ERROR');
    }
    expect(db.adminAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FAILED',
        metadata: expect.objectContaining({ amountCents: 10000 }),
      }),
    });
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: bookingId },
      data: { refundError: 'Error: Stripe down' },
    });
  });
});
