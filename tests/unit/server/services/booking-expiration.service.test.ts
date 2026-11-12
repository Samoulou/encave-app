import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    // The cancellation CAS and the gift release are one interactive
    // transaction — run the callback on the same mocked delegates.
    $transaction: vi.fn(
      async (
        callback: (_tx: {
          booking: {
            findUnique: typeof import('@/server/db').db.booking.findUnique;
            update: typeof import('@/server/db').db.booking.update;
            updateMany: typeof import('@/server/db').db.booking.updateMany;
          };
        }) => Promise<unknown>
      ) => {
        const { db } = await import('@/server/db');
        return callback({
          booking: {
            findUnique: db.booking.findUnique,
            update: db.booking.update,
            updateMany: db.booking.updateMany,
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
  releaseGiftForBookingInTx: vi.fn(async () => 'noop'),
}));

vi.mock('@/server/services/booking-refund.service', () => ({
  flagStuckCancellationRefunds: vi.fn(async () => 0),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
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
    // The status-guarded CAS defaults to "no row matched" (e.g. a racing
    // webhook already confirmed the booking); the cancel test overrides to 1.
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 0 } as never);
  });

  it('cancels expired pending bookings and sends an email', async () => {
    const now = new Date('2026-05-19T12:00:00Z');
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'booking-1',
        reference: 'ENC-ABC123',
        visitorEmail: 'client@test.ch',
        visitorName: 'Alice',
        locale: 'FR',
        createdAt: new Date('2026-05-19T11:20:00Z'),
        stripeCheckoutSessionId: 'cs_test_123',
        date: new Date('2026-05-20T00:00:00Z'),
        experience: { title: 'Atelier pinot', slug: 'atelier-pinot' },
      },
    ] as never);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      status: BookingStatus.PENDING_PAYMENT,
    } as never);
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await expirePendingPaymentBookings(now);

    expect(result.expired).toBe(1);
    expect(db.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'booking-1',
          status: BookingStatus.PENDING_PAYMENT,
        },
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED_BY_CLIENT,
          cancellationReason: 'PAYMENT_EXPIRED',
        }),
      })
    );
    expect(expireMock).toHaveBeenCalledWith('cs_test_123');
    expect(sendBookingExpiredEmail).toHaveBeenCalledWith(
      'client@test.ch',
      expect.objectContaining({ experienceSlug: 'atelier-pinot' }),
      'FR'
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
        locale: 'FR',
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
        locale: 'FR',
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
        locale: 'FR',
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
        locale: 'FR',
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

  describe('sweep shape (oldest first, drained page by page)', () => {
    const candidate = (id: string) => ({
      id,
      reference: `ENC-${id}`,
      visitorEmail: `${id}@test.ch`,
      visitorName: 'Alice',
      locale: 'FR',
      createdAt: new Date('2026-05-19T10:00:00Z'),
      expiresAt: new Date('2026-05-19T11:00:00Z'),
      stripeCheckoutSessionId: null,
      date: new Date('2026-05-20T00:00:00Z'),
      experience: { title: 'Atelier pinot', slug: 'atelier-pinot' },
    });
    const now = new Date('2026-05-19T12:00:00Z');

    it('orders by expiresAt ascending and keeps paging until the queue is empty, excluding rows already seen', async () => {
      vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
      vi.mocked(db.booking.findMany)
        .mockResolvedValueOnce([candidate('a'), candidate('b')] as never)
        .mockResolvedValueOnce([candidate('c')] as never)
        .mockResolvedValueOnce([] as never);

      const result = await expirePendingPaymentBookings(now, { batchSize: 2 });

      expect(result).toMatchObject({
        expired: 3,
        failed: 0,
        budgetExhausted: false,
      });
      const calls = vi.mocked(db.booking.findMany).mock.calls;
      expect(calls).toHaveLength(3);
      for (const [args] of calls) {
        expect(args).toMatchObject({
          orderBy: [
            { expiresAt: { sort: 'asc', nulls: 'first' } },
            { id: 'asc' },
          ],
          take: 2,
        });
      }
      // Page 2 never re-reads what page 1 handled (or skipped).
      expect(calls[1]?.[0]).toMatchObject({
        where: { id: { notIn: ['a', 'b'] } },
      });
      expect(calls[2]?.[0]).toMatchObject({
        where: { id: { notIn: ['a', 'b', 'c'] } },
      });
    });

    it('a row it must skip (paid session) does not stop the rows behind it', async () => {
      const paid = { ...candidate('paid'), stripeCheckoutSessionId: 'cs_paid' };
      retrieveMock.mockResolvedValue({
        payment_status: 'paid',
        status: 'complete',
      });
      vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
      vi.mocked(db.booking.findMany)
        .mockResolvedValueOnce([paid] as never)
        .mockResolvedValueOnce([candidate('behind')] as never)
        .mockResolvedValueOnce([] as never);

      const result = await expirePendingPaymentBookings(now, { batchSize: 1 });

      expect(result).toMatchObject({ expired: 1, skipped: 1 });
    });

    it('ends when a page brings nothing new — it can never spin on rows already handled', async () => {
      vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
      // A store that keeps answering the same row.
      vi.mocked(db.booking.findMany).mockResolvedValue([
        candidate('a'),
      ] as never);

      const result = await expirePendingPaymentBookings(now);

      expect(result.expired).toBe(1);
      expect(db.booking.findMany).toHaveBeenCalledTimes(2);
    });

    it('stops at the time budget and reports it', async () => {
      vi.mocked(db.booking.findMany).mockResolvedValue([
        candidate('a'),
      ] as never);

      const result = await expirePendingPaymentBookings(now, { budgetMs: 0 });

      expect(result).toMatchObject({ expired: 0, budgetExhausted: true });
      expect(db.booking.findMany).not.toHaveBeenCalled();
    });

    it('returns the reserved gift in the SAME transaction as the cancellation', async () => {
      const { releaseGiftForBookingInTx } =
        await import('@/server/services/giftCard-redemption.service');
      vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
      vi.mocked(db.booking.findMany)
        .mockResolvedValueOnce([candidate('a')] as never)
        .mockResolvedValueOnce([] as never);

      await expirePendingPaymentBookings(now);

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(releaseGiftForBookingInTx).toHaveBeenCalledWith(
        expect.anything(),
        'a'
      );
    });

    it('does not release anything when the cancellation CAS is lost (confirmed meanwhile)', async () => {
      const { releaseGiftForBookingInTx } =
        await import('@/server/services/giftCard-redemption.service');
      vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 0 } as never);
      vi.mocked(db.booking.findMany)
        .mockResolvedValueOnce([candidate('a')] as never)
        .mockResolvedValueOnce([] as never);

      const result = await expirePendingPaymentBookings(now);

      expect(result).toMatchObject({ expired: 0, skipped: 1 });
      expect(releaseGiftForBookingInTx).not.toHaveBeenCalled();
      expect(sendBookingExpiredEmail).not.toHaveBeenCalled();
    });
  });
});
