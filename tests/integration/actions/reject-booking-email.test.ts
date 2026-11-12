import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

/**
 * rejectBooking — the client's cancellation email (pre-launch audit, item
 * « fire-and-forget emails »). The send used to be a floating promise: the
 * serverless function could freeze right after the response and drop it.
 * It is now AWAITED, and a failing email must never fail the action — the
 * rejection is already committed.
 */

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    cache: <T extends (..._args: unknown[]) => unknown>(fn: T) => fn,
  };
});

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn() },
    booking: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock('@/server/stripe', () => ({ getStripe: vi.fn() }));
vi.mock('@/server/queries/booking.queries', () => ({
  getWineryBookings: vi.fn(),
}));
vi.mock('@/server/services/giftCard-redemption.service', () => ({
  releaseGiftForBooking: vi.fn(async () => undefined),
}));
vi.mock('@/server/services/email.service', () => ({
  sendBookingCancellationEmail: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { logError } from '@/lib/logger';
import { sendBookingCancellationEmail } from '@/server/services/email.service';
import { rejectBooking } from '@/server/actions/booking-dashboard';

const pendingBooking = {
  id: 'booking-1',
  reference: 'ENC-REJECT01',
  status: BookingStatus.PENDING_PAYMENT,
  visitorName: 'Anna Muster',
  visitorEmail: 'anna@example.com',
  date: new Date('2026-11-20T00:00:00.000Z'),
  totalPrice: 5000,
  locale: 'DE',
  stripeCheckoutSessionId: null,
  experience: { title: 'Degustation' },
  winery: { name: 'Cave du Rhodan' },
};

describe('rejectBooking — client cancellation email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'cave@example.com' },
    } as never);
    vi.mocked(db.winery.findUnique).mockResolvedValue({
      id: 'winery-1',
    } as never);
    vi.mocked(db.booking.findFirst).mockResolvedValue(pendingBooking as never);
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it('awaits the email before answering (not fire-and-forget)', async () => {
    let delivered = false;
    vi.mocked(sendBookingCancellationEmail).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      delivered = true;
      return true;
    });

    const result = await rejectBooking('booking-1');

    // With a floating promise the action would resolve while the send is
    // still pending — exactly what a frozen lambda drops.
    expect(delivered).toBe(true);
    expect(result).toEqual({
      success: true,
      data: { status: BookingStatus.CANCELLED_BY_WINERY },
    });
    expect(sendBookingCancellationEmail).toHaveBeenCalledWith(
      'anna@example.com',
      expect.objectContaining({ bookingRef: 'ENC-REJECT01' }),
      // Client email in the booking's own locale.
      'DE'
    );
  });

  it('a throwing email never fails the action — the rejection is committed', async () => {
    vi.mocked(sendBookingCancellationEmail).mockRejectedValue(
      new Error('resend down')
    );

    const result = await rejectBooking('booking-1');

    expect(result.success).toBe(true);
    expect(logError).toHaveBeenCalledWith(
      'Failed to send booking rejection email',
      expect.any(Error),
      { bookingId: 'booking-1' }
    );
  });

  it('an email that reports "not sent" is logged, the action still succeeds', async () => {
    vi.mocked(sendBookingCancellationEmail).mockResolvedValue(false);

    const result = await rejectBooking('booking-1');

    expect(result.success).toBe(true);
    expect(logError).toHaveBeenCalledWith(
      'Booking rejection email not sent',
      undefined,
      { bookingId: 'booking-1' }
    );
  });

  it('no email when the booking was confirmed in the meantime (CAS lost)', async () => {
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 0 } as never);

    const result = await rejectBooking('booking-1');

    expect(result.success).toBe(false);
    expect(sendBookingCancellationEmail).not.toHaveBeenCalled();
  });
});
