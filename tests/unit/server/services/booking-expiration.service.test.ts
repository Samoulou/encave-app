import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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
