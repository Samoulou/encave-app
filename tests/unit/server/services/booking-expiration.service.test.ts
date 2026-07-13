import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(
      async (
        callback: (tx: {
          booking: {
            findUnique: typeof import('@/server/db').db.booking.findUnique;
            update: typeof import('@/server/db').db.booking.update;
          };
        }) => Promise<unknown>
      ) => {
        const { db } = await import('@/server/db');
        return callback({
          booking: {
            findUnique: db.booking.findUnique,
            update: db.booking.update,
          },
        });
      }
    ),
  },
}));

const expireMock = vi.fn();
const retrieveMock = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { expire: expireMock, retrieve: retrieveMock } },
  }),
}));

vi.mock('@/server/services/giftCard-redemption.service', () => ({
  releaseGiftForBooking: vi.fn(async () => 'noop'),
}));

vi.mock('@/server/services/email.service', () => ({
  sendBookingExpiredEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { db } = await import('@/server/db');
const { sendBookingExpiredEmail } =
  await import('@/server/services/email.service');
const { expirePendingPaymentBookings } =
  await import('@/server/services/booking-expiration.service');

describe('expirePendingPaymentBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expireMock.mockResolvedValue({});
    retrieveMock.mockResolvedValue({ payment_status: 'unpaid' });
  });

  it('cancels expired pending bookings and sends an email', async () => {
    const now = new Date('2026-05-19T12:00:00Z');
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        reference: 'ENC-ABC123',
        visitorEmail: 'client@test.ch',
        visitorName: 'Alice',
        createdAt: new Date('2026-05-19T11:20:00Z'),
        stripeCheckoutSessionId: 'cs_test_123',
        date: new Date('2026-05-20T00:00:00Z'),
        experience: { title: 'Atelier pinot', slug: 'atelier-pinot' },
      },
    ] as never);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      status: BookingStatus.PENDING_PAYMENT,
    } as never);
    vi.mocked(db.booking.update).mockResolvedValue({} as never);

    const result = await expirePendingPaymentBookings(now);

    expect(result.expired).toBe(1);
    expect(db.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED_BY_CLIENT,
          cancellationReason: 'PAYMENT_EXPIRED',
        }),
      })
    );
    expect(expireMock).toHaveBeenCalledWith('cs_test_123');
    expect(sendBookingExpiredEmail).toHaveBeenCalledWith(
      'client@test.ch',
      expect.objectContaining({ experienceSlug: 'atelier-pinot' })
    );
  });

  it('selects on the booking own expiry — never createdAt for held rows', async () => {
    const now = new Date('2026-05-19T12:00:00Z');
    vi.mocked(db.booking.findMany).mockResolvedValue([] as never);

    await expirePendingPaymentBookings(now);

    // A hold claimed at submit lives until its Stripe session expiry
    // (up to createdAt + 40 min) — a createdAt cutoff would cancel
    // bookings MID-PAYMENT (P-04 review finding).
    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { expiresAt: { lt: now } },
            expect.objectContaining({ expiresAt: null }),
          ],
        }),
      })
    );
  });

  it('does not reap a claimed hold whose payment window is still open', async () => {
    const now = new Date('2026-05-19T12:00:00Z');
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        reference: 'ENC-ABC123',
        visitorEmail: 'client@test.ch',
        visitorName: 'Alice',
        createdAt: new Date('2026-05-19T11:20:00Z'), // 40 min ago
        expiresAt: new Date('2026-05-19T12:05:00Z'), // session still live
        stripeCheckoutSessionId: 'cs_test_123',
        date: new Date('2026-05-20T00:00:00Z'),
        experience: { title: 'Atelier pinot', slug: 'atelier-pinot' },
      },
    ] as never);

    const result = await expirePendingPaymentBookings(now);

    expect(result.expired).toBe(0);
    expect(db.booking.update).not.toHaveBeenCalled();
    expect(expireMock).not.toHaveBeenCalled();
  });

  it('deletes an unclaimed hold silently — no cancellation, no email', async () => {
    const now = new Date('2026-05-19T12:00:00Z');
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'hold-1',
        reference: 'ENC-HOLD1234',
        visitorEmail: 'hold-enc-hold1234@hold.encave.ch',
        visitorName: '',
        createdAt: new Date('2026-05-19T11:40:00Z'),
        expiresAt: new Date('2026-05-19T11:50:00Z'),
        stripeCheckoutSessionId: null,
        date: new Date('2026-05-20T00:00:00Z'),
        experience: { title: 'Atelier pinot', slug: 'atelier-pinot' },
      },
    ] as never);
    vi.mocked(db.booking.deleteMany).mockResolvedValue({ count: 1 } as never);

    const result = await expirePendingPaymentBookings(now);

    expect(result.deletedHolds).toBe(1);
    expect(result.expired).toBe(0);
    // No CANCELLED ghost row, no bounce to the sentinel domain.
    expect(db.booking.update).not.toHaveBeenCalled();
    expect(sendBookingExpiredEmail).not.toHaveBeenCalled();
    expect(db.booking.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'hold-1',
        status: BookingStatus.PENDING_PAYMENT,
        stripeCheckoutSessionId: null,
      },
    });
  });

  it('does not touch bookings confirmed by a racing webhook', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        reference: 'ENC-ABC123',
        visitorEmail: 'client@test.ch',
        visitorName: 'Alice',
        createdAt: new Date('2026-05-19T11:20:00Z'),
        stripeCheckoutSessionId: 'cs_test_123',
        date: new Date('2026-05-20T00:00:00Z'),
        experience: { title: 'Atelier pinot', slug: 'atelier-pinot' },
      },
    ] as never);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      status: BookingStatus.CONFIRMED,
    } as never);

    const result = await expirePendingPaymentBookings(
      new Date('2026-05-19T12:00:00Z')
    );

    expect(result.expired).toBe(0);
    expect(db.booking.update).not.toHaveBeenCalled();
    expect(sendBookingExpiredEmail).not.toHaveBeenCalled();
  });

  it('leaves a PAID session to the late webhook instead of cancelling', async () => {
    retrieveMock.mockResolvedValue({ payment_status: 'paid' });
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        reference: 'ENC-ABC123',
        visitorEmail: 'client@test.ch',
        visitorName: 'Alice',
        createdAt: new Date('2026-05-19T11:20:00Z'),
        stripeCheckoutSessionId: 'cs_test_123',
        date: new Date('2026-05-20T00:00:00Z'),
        experience: { title: 'Atelier pinot', slug: 'atelier-pinot' },
      },
    ] as never);

    const result = await expirePendingPaymentBookings(
      new Date('2026-05-19T12:00:00Z')
    );

    expect(result.expired).toBe(0);
    expect(db.booking.update).not.toHaveBeenCalled();
    expect(expireMock).not.toHaveBeenCalled();
    expect(sendBookingExpiredEmail).not.toHaveBeenCalled();
  });

  it('skips the candidate this run when Stripe cannot be reached', async () => {
    retrieveMock.mockRejectedValue(new Error('network'));
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        reference: 'ENC-ABC123',
        visitorEmail: 'client@test.ch',
        visitorName: 'Alice',
        createdAt: new Date('2026-05-19T11:20:00Z'),
        stripeCheckoutSessionId: 'cs_test_123',
        date: new Date('2026-05-20T00:00:00Z'),
        experience: { title: 'Atelier pinot', slug: 'atelier-pinot' },
      },
    ] as never);

    const result = await expirePendingPaymentBookings(
      new Date('2026-05-19T12:00:00Z')
    );

    expect(result.expired).toBe(0);
    expect(db.booking.update).not.toHaveBeenCalled();
    expect(sendBookingExpiredEmail).not.toHaveBeenCalled();
  });
});
