import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus } from '@prisma/client';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));
vi.mock('@/server/db', () => ({
  db: {
    experience: { findUnique: vi.fn(), findFirst: vi.fn() },
    booking: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { expire: vi.fn(async () => ({})) } },
  }),
}));
vi.mock('@/server/services/booking-refund.service', () => ({
  CANCEL_REFUND_PENDING_PREFIX: 'CANCEL_REFUND_PENDING',
  CANCEL_REFUND_STUCK_PREFIX: 'CANCEL_REFUND_STUCK',
  appendRefundError: vi.fn(async () => undefined),
  claimBookingCancellation: vi.fn(async () => true),
  clearCancellationRefundMarker: vi.fn(async () => undefined),
  processCancellationRefund: vi.fn(),
  recordCancellationRefund: vi.fn(async () => undefined),
  wasNeverChargedOnline: vi.fn(() => false),
}));
vi.mock('@/server/services/email.service', () => ({
  sendBookingCancelledByWineryEmail: vi.fn(async () => true),
}));
vi.mock('@/server/queries/winery-alternatives.queries', () => ({
  getNearbyWineryAlternatives: vi.fn(async () => []),
}));
vi.mock('@/server/services/occurrence.service', () => ({
  cancelOccurrenceForSlot: vi.fn(async () => undefined),
}));
vi.mock('@/server/services/no-show.service', () => ({
  refundNoShowFeeIfCharged: vi.fn(),
}));
vi.mock('@/server/services/giftCard-redemption.service', () => ({
  releaseGiftForBooking: vi.fn(async () => 'noop'),
}));
vi.mock('@/server/actions/experience-helpers', () => ({
  invalidateExperienceCaches: vi.fn(),
}));

import { auth } from '@/server/auth';
import { db } from '@/server/db';
import {
  appendRefundError,
  claimBookingCancellation,
  clearCancellationRefundMarker,
  processCancellationRefund,
  recordCancellationRefund,
  wasNeverChargedOnline,
} from '@/server/services/booking-refund.service';
import { sendBookingCancelledByWineryEmail } from '@/server/services/email.service';
import { releaseGiftForBooking } from '@/server/services/giftCard-redemption.service';
import { cancelEventSession } from '@/server/actions/event-detail';

const EXPERIENCE_ID = 'ckexperienceabcdefghij123456';
const input = {
  experienceId: EXPERIENCE_ID,
  sessionId: '2027-06-01|10:00',
  reason: 'Fermeture exceptionnelle de la cave ce jour-là.',
};

function sessionBooking(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `booking-${n}`,
    reference: `ENC-SESS000${n}`,
    visitorEmail: `guest${n}@example.com`,
    visitorName: `Guest ${n}`,
    guestCount: 2,
    totalPrice: 9000,
    serviceFeeCents: 500,
    status: BookingStatus.CONFIRMED,
    locale: 'FR',
    stripeCheckoutSessionId: `cs_test_${n}`,
    stripePaymentIntentId: `pi_test_${n}`,
    giftAppliedCents: 0,
    wineryPayout: 8100,
    refundAmount: null,
    noShowSetupIntentId: null,
    ...overrides,
  };
}

const refundedInFull = {
  cardRefundCents: 9500,
  stripeRefundId: 're_1',
  giftRestoredCents: 0,
  totalReturnedCents: 9500,
  ledgerDriftCents: 0,
};

describe('cancelEventSession — bounded, per-booking, resumable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: 'user-owner' } } as never);
    vi.mocked(db.experience.findUnique).mockResolvedValue({
      id: EXPERIENCE_ID,
      slug: 'tasting',
      title: 'Dégustation',
      duration: 60,
      winery: {
        id: 'winery-1',
        userId: 'user-owner',
        name: 'Cave Test',
        user: { preferredLocale: 'FR' },
      },
    } as never);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      refundAmount: null,
    } as never);
    vi.mocked(claimBookingCancellation).mockResolvedValue(true);
    vi.mocked(processCancellationRefund).mockResolvedValue(refundedInFull);
    vi.mocked(wasNeverChargedOnline).mockReturnValue(false);
  });

  it('refuses a caller who does not own the experience', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'someone-else' },
    } as never);

    const result = await cancelEventSession(input);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
    expect(db.booking.findMany).not.toHaveBeenCalled();
  });

  it('picks up live bookings AND bookings a previous run claimed without finishing their refund', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([] as never);

    await cancelEventSession(input);

    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          experienceId: EXPERIENCE_ID,
          date: new Date('2027-06-01T00:00:00.000Z'),
          timeSlot: '10:00',
          OR: [
            {
              status: {
                in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT],
              },
            },
            {
              status: BookingStatus.CANCELLED_BY_WINERY,
              OR: [
                { refundError: { contains: 'CANCEL_REFUND_PENDING(' } },
                { refundError: { contains: 'CANCEL_REFUND_STUCK(' } },
              ],
            },
          ],
        },
      })
    );
  });

  it('refunds every booking in full and reports the totals', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      sessionBooking(1),
      sessionBooking(2),
      sessionBooking(3),
    ] as never);

    const result = await cancelEventSession(input);

    expect(result).toEqual({
      success: true,
      data: {
        cancelled: 3,
        refunded: 28500,
        failed: 0,
        failedReferences: [],
      },
    });
    // The claim records the owed refund (tickets + service fee) atomically.
    expect(claimBookingCancellation).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      from: BookingStatus.CONFIRMED,
      to: BookingStatus.CANCELLED_BY_WINERY,
      cancellationReason: input.reason,
      refundDueCents: 9500,
    });
    expect(recordCancellationRefund).toHaveBeenCalledTimes(3);
    expect(clearCancellationRefundMarker).toHaveBeenCalledTimes(3);
    expect(sendBookingCancelledByWineryEmail).toHaveBeenCalledTimes(3);
  });

  it('one failing refund does not stop the others: it is reported by reference and keeps its marker', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      sessionBooking(1),
      sessionBooking(2),
      sessionBooking(3),
    ] as never);
    vi.mocked(processCancellationRefund).mockImplementation(async (args) => {
      if (args.bookingId === 'booking-2') throw new Error('Stripe is down');
      return refundedInFull;
    });

    const result = await cancelEventSession(input);

    expect(result).toEqual({
      success: true,
      data: {
        cancelled: 2,
        refunded: 19000,
        failed: 1,
        failedReferences: ['ENC-SESS0002'],
      },
    });
    // The failed booking: error appended, NO email (the client is told once,
    // with the real amount, when the refund goes through)…
    expect(appendRefundError).toHaveBeenCalledWith(
      'booking-2',
      expect.stringContaining('Stripe is down')
    );
    const emailed = vi
      .mocked(sendBookingCancelledByWineryEmail)
      .mock.calls.map((call) => call[0]);
    expect(emailed).toEqual(['guest1@example.com', 'guest3@example.com']);
    // …and its CANCEL_REFUND marker is left in place: it is what makes the
    // next run resume it.
    const cleared = vi
      .mocked(clearCancellationRefundMarker)
      .mock.calls.map((call) => call[0]);
    expect(cleared).toEqual(['booking-1', 'booking-3']);
  });

  it('RESUME: a booking already claimed by a failed run is refunded and emailed without being re-claimed', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      sessionBooking(2, { status: BookingStatus.CANCELLED_BY_WINERY }),
    ] as never);

    const result = await cancelEventSession(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ cancelled: 1, failed: 0 });
    }
    expect(claimBookingCancellation).not.toHaveBeenCalled();
    expect(processCancellationRefund).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-2', refundDueCents: 9500 })
    );
    // Cleared unconditionally: the marker carries the ORIGINAL amount.
    expect(clearCancellationRefundMarker).toHaveBeenCalledWith(
      'booking-2',
      undefined
    );
    expect(sendBookingCancelledByWineryEmail).toHaveBeenCalledTimes(1);
  });

  it('never processes more than 4 bookings at once', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => sessionBooking(i + 1)) as never
    );
    let inFlight = 0;
    let peak = 0;
    vi.mocked(processCancellationRefund).mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return refundedInFull;
    });

    const result = await cancelEventSession(input);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cancelled).toBe(12);
    expect(peak).toBeGreaterThan(1); // not sequential any more
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('skips a booking another flow already cancelled (claim lost) — no refund, no email', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      sessionBooking(1),
    ] as never);
    vi.mocked(claimBookingCancellation).mockResolvedValue(false);

    const result = await cancelEventSession(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ cancelled: 0, failed: 0 });
    }
    expect(processCancellationRefund).not.toHaveBeenCalled();
    expect(sendBookingCancelledByWineryEmail).not.toHaveBeenCalled();
  });

  it('a pending booking is cancelled without a refund and its reserved gift is returned', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      sessionBooking(1, {
        status: BookingStatus.PENDING_PAYMENT,
        stripePaymentIntentId: null,
      }),
    ] as never);

    const result = await cancelEventSession(input);

    expect(result.success).toBe(true);
    expect(claimBookingCancellation).toHaveBeenCalledWith(
      expect.objectContaining({
        from: BookingStatus.PENDING_PAYMENT,
        refundDueCents: 0,
      })
    );
    expect(processCancellationRefund).not.toHaveBeenCalled();
    expect(releaseGiftForBooking).toHaveBeenCalledWith('booking-1');
  });
});
