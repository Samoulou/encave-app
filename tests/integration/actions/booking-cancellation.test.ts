import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { db } from '@/server/db';
import { BookingStatus } from '@prisma/client';

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(async () => 1),
  },
}));

// Mock payment service
vi.mock('@/server/services/payment.service', () => ({
  processRefund: vi.fn(),
}));

// Mock email service
vi.mock('@/server/services/email.service', () => ({
  sendBookingCancellationEmail: vi.fn().mockResolvedValue(true),
  sendWinemakerCancellationEmail: vi.fn().mockResolvedValue(true),
}));

import { processRefund } from '@/server/services/payment.service';
import {
  sendBookingCancellationEmail,
  sendWinemakerCancellationEmail,
} from '@/server/services/email.service';

describe('Booking Cancellation Actions', () => {
  const accessToken = 'test-cancel-token-abc123';
  const tokenHash = crypto
    .createHash('sha256')
    .update(accessToken)
    .digest('hex');

  // Create a date 48 hours in the future for refund-eligible booking
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  futureDate.setHours(14, 0, 0, 0);

  // Create a date 12 hours in the future for non-refund-eligible booking
  const nearFutureDate = new Date();
  nearFutureDate.setHours(nearFutureDate.getHours() + 12);

  // Create a date in the past
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1);

  const mockConfirmedBooking = {
    id: 'booking-cancel-1',
    reference: 'ENC-CAN001',
    status: BookingStatus.CONFIRMED,
    visitorName: 'Cancel Test User',
    visitorEmail: 'cancel@example.com',
    visitorPhone: '+41791234567',
    date: futureDate,
    timeSlot: '14:00',
    guestCount: 4,
    totalPrice: 20000,
    serviceFeeCents: 0,
    refundAmount: null,
    // P-16 (ADR-0003): the classic (non-gift) refund path.
    giftAppliedCents: 0,
    wineryPayout: 17600,
    stripePaymentIntentId: 'pi_test123',
    accessToken,
    accessTokenHash: tokenHash,
    experience: {
      title: 'Cancellable Wine Tasting',
      duration: 90,
    },
    winery: {
      name: 'Test Winery',
      email: 'winery@example.com',
      cancellationPolicy: 'STANDARD',
      user: {
        name: 'Winemaker Name',
        preferredLocale: 'en',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // The atomic cancellation claim + conditional ledger write succeed
    // by default; the final read-back returns the cancelled row.
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.booking.findUniqueOrThrow).mockResolvedValue({
      id: 'booking-cancel-1',
      status: BookingStatus.CANCELLED_BY_CLIENT,
    } as never);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-11T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cancelBooking', () => {
    it('cancels booking with full refund when >24h before experience', async () => {
      // Set booking date to 48+ hours in the future
      const bookingWithFutureDate = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-14'), // 3 days in future
        timeSlot: '14:00',
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingWithFutureDate as never
      );
      vi.mocked(db.booking.update).mockResolvedValue({
        ...bookingWithFutureDate,
        status: BookingStatus.CANCELLED_BY_CLIENT,
        cancelledAt: new Date(),
        refundIssued: true,
        refundAmount: 20000,
        stripeRefundId: 're_test123',
      } as never);
      vi.mocked(processRefund).mockResolvedValue({
        refundId: 're_test123',
        amount: 20000,
      });

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.refundIssued).toBe(true);
        expect(result.data.refundAmount).toBe(20000);
        expect(result.data.status).toBe(BookingStatus.CANCELLED_BY_CLIENT);
      }
      // Always an EXPLICIT amount — "refund the remaining balance" would
      // silently change meaning under a concurrent admin refund.
      expect(processRefund).toHaveBeenCalledWith(
        'pi_test123',
        true,
        20000,
        expect.stringMatching(/^cancel-refund:/)
      );
    });

    it('cancels booking without refund when <24h before experience', async () => {
      // Set booking date to 12 hours in the future
      const bookingNearFuture = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-11'), // Same day
        timeSlot: '22:00', // 12 hours from now (10:00 + 12 = 22:00)
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingNearFuture as never
      );
      vi.mocked(db.booking.update).mockResolvedValue({
        ...bookingNearFuture,
        status: BookingStatus.CANCELLED_BY_CLIENT,
        cancelledAt: new Date(),
        refundIssued: false,
        refundAmount: null,
        stripeRefundId: null,
      } as never);

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.refundIssued).toBe(false);
        expect(result.data.refundAmount).toBeNull();
        expect(result.data.status).toBe(BookingStatus.CANCELLED_BY_CLIENT);
      }
      expect(processRefund).not.toHaveBeenCalled();
    });

    it('refunds at exactly 24h — boundary included in the STANDARD tier (D1)', async () => {
      // D1 barème: « 100 % jusqu'à 24 h » — the boundary itself refunds.
      const bookingAt24h = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-12'), // Tomorrow
        timeSlot: '10:00', // Exactly 24 hours from 2026-01-11T10:00
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(bookingAt24h as never);
      vi.mocked(db.booking.update).mockResolvedValue({
        ...bookingAt24h,
        status: BookingStatus.CANCELLED_BY_CLIENT,
        refundIssued: false,
      } as never);

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        // Exactly 24h = 100% refund (STANDARD tier is >= 24h)
        expect(result.data.refundIssued).toBe(true);
      }
      expect(processRefund).toHaveBeenCalledWith(
        'pi_test123',
        true,
        20000,
        expect.stringMatching(/^cancel-refund:/)
      );
    });

    it('refunds 50% of tickets + fee on the STRICT middle tier (D2)', async () => {
      const strictBooking = {
        ...mockConfirmedBooking,
        serviceFeeCents: 1000,
        date: new Date('2026-01-14'), // 72h before → STRICT 50% tier
        timeSlot: '10:00',
        winery: {
          ...mockConfirmedBooking.winery,
          cancellationPolicy: 'STRICT',
        },
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(strictBooking as never);
      vi.mocked(db.booking.update).mockResolvedValue({
        ...strictBooking,
        status: BookingStatus.CANCELLED_BY_CLIENT,
      } as never);
      vi.mocked(processRefund).mockResolvedValue({
        refundId: 're_partial',
        amount: 10500,
      });

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      // paid = 20000 + 1000 fee; 50% = 10500 — exact partial amount sent
      // to Stripe, fee included (decision D2).
      expect(processRefund).toHaveBeenCalledWith(
        'pi_test123',
        true,
        10500,
        'cancel-refund:booking-cancel-1:10500'
      );
    });

    it('refunds nothing when the atomic claim is lost (concurrent cancel)', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        mockConfirmedBooking as never
      );
      // Another request already flipped CONFIRMED -> CANCELLED.
      vi.mocked(db.booking.updateMany).mockResolvedValue({
        count: 0,
      } as never);

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
      expect(processRefund).not.toHaveBeenCalled();
      expect(db.booking.update).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND for invalid access token', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', 'invalid-token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('not found');
      }
    });

    it('returns VALIDATION_ERROR for non-confirmed booking', async () => {
      const pendingBooking = {
        ...mockConfirmedBooking,
        status: BookingStatus.PENDING_PAYMENT,
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        pendingBooking as never
      );

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('confirmed');
      }
    });

    it('returns VALIDATION_ERROR for past booking', async () => {
      const pastBooking = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-10'), // Yesterday
        timeSlot: '14:00',
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(pastBooking as never);

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('past');
      }
    });

    it('returns PAYMENT_FAILED when refund processing fails', async () => {
      const bookingWithFutureDate = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-14'),
        timeSlot: '14:00',
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingWithFutureDate as never
      );
      vi.mocked(processRefund).mockRejectedValue(new Error('Stripe API error'));

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PAYMENT_FAILED');
        expect(result.error.message).toContain('refund');
      }
    });

    it('sends cancellation email to client', async () => {
      const bookingWithFutureDate = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-14'),
        timeSlot: '14:00',
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingWithFutureDate as never
      );
      vi.mocked(db.booking.update).mockResolvedValue({
        ...bookingWithFutureDate,
        status: BookingStatus.CANCELLED_BY_CLIENT,
        refundIssued: true,
        refundAmount: 20000,
      } as never);
      vi.mocked(processRefund).mockResolvedValue({
        refundId: 're_test123',
        amount: 20000,
      });

      const { cancelBooking } = await import('@/server/actions/booking');
      await cancelBooking('booking-cancel-1', accessToken);

      expect(sendBookingCancellationEmail).toHaveBeenCalledWith(
        'cancel@example.com',
        expect.objectContaining({
          guestName: 'Cancel Test User',
          experienceTitle: 'Cancellable Wine Tasting',
          wineryName: 'Test Winery',
          bookingRef: 'ENC-CAN001',
        })
      );
    });

    it('sends notification email to winemaker', async () => {
      const bookingWithFutureDate = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-14'),
        timeSlot: '14:00',
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingWithFutureDate as never
      );
      vi.mocked(db.booking.update).mockResolvedValue({
        ...bookingWithFutureDate,
        status: BookingStatus.CANCELLED_BY_CLIENT,
        refundIssued: true,
        refundAmount: 20000,
      } as never);
      vi.mocked(processRefund).mockResolvedValue({
        refundId: 're_test123',
        amount: 20000,
      });

      const { cancelBooking } = await import('@/server/actions/booking');
      await cancelBooking('booking-cancel-1', accessToken);

      expect(sendWinemakerCancellationEmail).toHaveBeenCalledWith(
        'winery@example.com',
        expect.objectContaining({
          winemakerName: 'Winemaker Name',
          experienceTitle: 'Cancellable Wine Tasting',
          guestName: 'Cancel Test User',
          guestCount: 4,
          bookingRef: 'ENC-CAN001',
        }),
        'en'
      );
    });

    it('updates booking with cancellation fields', async () => {
      const bookingWithFutureDate = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-14'),
        timeSlot: '14:00',
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingWithFutureDate as never
      );
      vi.mocked(db.booking.update).mockResolvedValue({
        ...bookingWithFutureDate,
        status: BookingStatus.CANCELLED_BY_CLIENT,
      } as never);
      vi.mocked(processRefund).mockResolvedValue({
        refundId: 're_test123',
        amount: 20000,
      });

      const { cancelBooking } = await import('@/server/actions/booking');
      await cancelBooking('booking-cancel-1', accessToken);

      // Status flips in the atomic claim; the ledger write is CONDITIONAL
      // on the refundAmount that was read — a concurrent admin refund
      // must never be clobbered (P-04 review finding).
      expect(db.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-cancel-1', status: BookingStatus.CONFIRMED },
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED_BY_CLIENT,
          cancelledAt: expect.any(Date),
        }),
      });
      expect(db.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-cancel-1', refundAmount: null },
        data: expect.objectContaining({
          refundIssued: true,
          refundAmount: 20000,
          stripeRefundId: 're_test123',
        }),
      });
    });

    it('flags a ledger conflict instead of clobbering a concurrent refund', async () => {
      const bookingWithFutureDate = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-14'),
        timeSlot: '14:00',
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingWithFutureDate as never
      );
      vi.mocked(processRefund).mockResolvedValue({
        refundId: 're_test123',
        amount: 20000,
      });
      // Claim wins, but the conditional ledger write loses: an admin
      // refund changed refundAmount between our read and our write.
      vi.mocked(db.booking.updateMany)
        .mockResolvedValueOnce({ count: 1 } as never) // status claim
        .mockResolvedValueOnce({ count: 0 } as never); // ledger CAS
      vi.mocked(db.booking.update).mockResolvedValue({} as never);

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      // The DB value is kept; the conflict is flagged for reconciliation
      // via the atomic refundError append ($executeRaw — message is arg 1).
      const appended = vi
        .mocked(db.$executeRaw)
        .mock.calls.map((call) => String(call[1]))
        .join(' ');
      expect(appended).toContain('LEDGER_CONFLICT');
    });

    it('verifies token using SHA-256 hash', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const { cancelBooking } = await import('@/server/actions/booking');
      await cancelBooking('booking-cancel-1', accessToken);

      expect(db.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'booking-cancel-1',
            accessTokenHash: tokenHash,
          },
        })
      );
    });

    it('handles booking without stripePaymentIntentId (no refund needed)', async () => {
      const bookingNoPayment = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-14'),
        timeSlot: '14:00',
        stripePaymentIntentId: null, // No payment made
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingNoPayment as never
      );
      vi.mocked(db.booking.update).mockResolvedValue({
        ...bookingNoPayment,
        status: BookingStatus.CANCELLED_BY_CLIENT,
        refundIssued: false,
      } as never);

      const { cancelBooking } = await import('@/server/actions/booking');
      const result = await cancelBooking('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      // Should not call processRefund even though >24h (no payment to refund)
      expect(processRefund).not.toHaveBeenCalled();
    });
  });

  describe('getCancellationInfo', () => {
    it('returns refund eligible info when >24h before experience', async () => {
      const bookingWithFutureDate = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-14'), // 3 days in future
        timeSlot: '14:00',
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingWithFutureDate as never
      );

      const { getCancellationInfo } = await import('@/server/actions/booking');
      const result = await getCancellationInfo('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canCancel).toBe(true);
        expect(result.data.isEligibleForRefund).toBe(true);
        expect(result.data.refundAmount).toBe(20000);
        expect(result.data.hoursUntilExperience).toBeGreaterThan(24);
      }
    });

    it('returns not refund eligible when <24h before experience', async () => {
      const bookingNearFuture = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-11'),
        timeSlot: '22:00', // 12 hours from 10:00
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        bookingNearFuture as never
      );

      const { getCancellationInfo } = await import('@/server/actions/booking');
      const result = await getCancellationInfo('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canCancel).toBe(true);
        expect(result.data.isEligibleForRefund).toBe(false);
        expect(result.data.refundAmount).toBe(0);
        expect(result.data.hoursUntilExperience).toBeLessThan(24);
      }
    });

    it('returns canCancel false for past booking', async () => {
      const pastBooking = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-10'), // Yesterday
        timeSlot: '14:00',
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(pastBooking as never);

      const { getCancellationInfo } = await import('@/server/actions/booking');
      const result = await getCancellationInfo('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canCancel).toBe(false);
        expect(result.data.reason).toContain('past');
      }
    });

    it('returns canCancel false for non-confirmed booking', async () => {
      const cancelledBooking = {
        ...mockConfirmedBooking,
        status: BookingStatus.CANCELLED_BY_CLIENT,
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(
        cancelledBooking as never
      );

      const { getCancellationInfo } = await import('@/server/actions/booking');
      const result = await getCancellationInfo('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canCancel).toBe(false);
        expect(result.data.reason).toContain('confirmed');
      }
    });

    it('returns NOT_FOUND for invalid token', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const { getCancellationInfo } = await import('@/server/actions/booking');
      const result = await getCancellationInfo(
        'booking-cancel-1',
        'invalid-token'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('verifies token using SHA-256 hash', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const { getCancellationInfo } = await import('@/server/actions/booking');
      await getCancellationInfo('booking-cancel-1', accessToken);

      expect(db.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'booking-cancel-1',
            accessTokenHash: tokenHash,
          },
        })
      );
    });

    it('calculates hours correctly for different time slots', async () => {
      // Test with early morning time slot
      const earlyBooking = {
        ...mockConfirmedBooking,
        date: new Date('2026-01-13'), // 2 days in future
        timeSlot: '09:30', // Early morning
      };
      vi.mocked(db.booking.findFirst).mockResolvedValue(earlyBooking as never);

      const { getCancellationInfo } = await import('@/server/actions/booking');
      const result = await getCancellationInfo('booking-cancel-1', accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        // 2026-01-13 09:30 - 2026-01-11 10:00 = ~47.5 hours
        expect(result.data.hoursUntilExperience).toBeGreaterThan(40);
        expect(result.data.hoursUntilExperience).toBeLessThan(50);
      }
    });
  });
});
