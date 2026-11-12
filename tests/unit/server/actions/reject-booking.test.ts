import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));

vi.mock('@/server/db', () => ({
  db: {
    winery: { findUnique: vi.fn() },
    booking: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));

const sessionsExpire = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { expire: sessionsExpire } } }),
}));

vi.mock('@/server/services/email.service', () => ({
  sendBookingCancellationEmail: vi.fn(),
}));

vi.mock('@/server/services/giftCard-redemption.service', () => ({
  releaseGiftForBooking: vi.fn(),
}));

vi.mock('@/server/queries/booking.queries', () => ({
  getWineryBookings: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { sendBookingCancellationEmail } =
  await import('@/server/services/email.service');
const { releaseGiftForBooking } =
  await import('@/server/services/giftCard-redemption.service');
const { logError } = await import('@/lib/logger');
const { rejectBooking } = await import('@/server/actions/booking-dashboard');

const session: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: 'FR',
    twoFactorEnabled: false,
    emailVerified: true,
  },
};

const pending = {
  id: 'booking-1',
  reference: 'ENC-REJECT01',
  status: BookingStatus.PENDING_PAYMENT,
  stripeCheckoutSessionId: 'cs_test_open',
  visitorEmail: 'guest@test.ch',
  visitorName: 'Guest Test',
  date: new Date('2026-12-05T00:00:00.000Z'),
  totalPrice: 9000,
  locale: 'DE',
  experience: { title: 'Dégustation' },
  winery: { name: 'Cave Test' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(session);
  vi.mocked(db.winery.findUnique).mockResolvedValue({ id: 'w-1' } as never);
  vi.mocked(db.booking.findFirst).mockResolvedValue(pending as never);
  vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(sendBookingCancellationEmail).mockResolvedValue(true as never);
  vi.mocked(releaseGiftForBooking).mockResolvedValue('noop' as never);
  sessionsExpire.mockResolvedValue({ id: 'cs_test_open', status: 'expired' });
});

describe('rejectBooking', () => {
  it('returns UNAUTHORIZED without a session', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await rejectBooking('booking-1');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it('returns FORBIDDEN when the caller owns no winery', async () => {
    vi.mocked(db.winery.findUnique).mockResolvedValue(null);

    const result = await rejectBooking('booking-1');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
  });

  it("scopes the lookup to the caller's winery (another winery's booking is NOT_FOUND)", async () => {
    vi.mocked(db.booking.findFirst).mockResolvedValue(null);

    const result = await rejectBooking('booking-of-another-winery');

    expect(db.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-of-another-winery', wineryId: 'w-1' },
      })
    );
    expect(result).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    BookingStatus.CONFIRMED,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED_BY_CLIENT,
  ])(
    'refuses a %s booking (only pending ones can be rejected)',
    async (status) => {
      vi.mocked(db.booking.findFirst).mockResolvedValue({
        ...pending,
        status,
      } as never);

      const result = await rejectBooking('booking-1');

      expect(result).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' },
      });
      expect(sessionsExpire).not.toHaveBeenCalled();
      expect(db.booking.updateMany).not.toHaveBeenCalled();
      expect(sendBookingCancellationEmail).not.toHaveBeenCalled();
    }
  );

  it('rejects a pending booking: expires the Stripe session, CAS on status, releases the gift, emails the guest in their locale', async () => {
    const result = await rejectBooking('booking-1');

    expect(result).toEqual({
      success: true,
      data: { status: BookingStatus.CANCELLED_BY_WINERY },
    });
    expect(sessionsExpire).toHaveBeenCalledWith('cs_test_open');
    // Compare-and-set: never clobber a webhook confirmation landing in
    // between (PENDING_PAYMENT is part of the WHERE).
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT },
      data: {
        status: BookingStatus.CANCELLED_BY_WINERY,
        cancelledAt: expect.any(Date),
      },
    });
    expect(releaseGiftForBooking).toHaveBeenCalledWith('booking-1');
    expect(sendBookingCancellationEmail).toHaveBeenCalledWith(
      'guest@test.ch',
      expect.objectContaining({
        guestName: 'Guest Test',
        experienceTitle: 'Dégustation',
        wineryName: 'Cave Test',
        bookingRef: 'ENC-REJECT01',
      }),
      'DE'
    );
  });

  it('loses the race against a payment confirmation: nothing is cancelled, released or emailed', async () => {
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 0 } as never);

    const result = await rejectBooking('booking-1');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(releaseGiftForBooking).not.toHaveBeenCalled();
    expect(sendBookingCancellationEmail).not.toHaveBeenCalled();
  });

  it('a Stripe expire failure does not block the rejection', async () => {
    sessionsExpire.mockRejectedValue(new Error('session already completed'));

    const result = await rejectBooking('booking-1');

    expect(result.success).toBe(true);
  });

  it('skips Stripe for a booking without a checkout session', async () => {
    vi.mocked(db.booking.findFirst).mockResolvedValue({
      ...pending,
      stripeCheckoutSessionId: null,
    } as never);

    const result = await rejectBooking('booking-1');

    expect(result.success).toBe(true);
    expect(sessionsExpire).not.toHaveBeenCalled();
  });

  it('an email failure is logged, never fails the committed rejection', async () => {
    vi.mocked(sendBookingCancellationEmail).mockRejectedValue(
      new Error('resend down')
    );

    const result = await rejectBooking('booking-1');

    expect(result.success).toBe(true);
    expect(logError).toHaveBeenCalled();
  });

  it('never throws: an unexpected DB failure becomes INTERNAL_ERROR', async () => {
    vi.mocked(db.booking.findFirst).mockRejectedValue(new Error('db down'));

    const result = await rejectBooking('booking-1');

    expect(result).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
