import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { BookingStatus } from '@prisma/client';
import { db } from '@/server/db';
import {
  sendBookingConfirmationEmail,
  sendWinemakerNewBookingEmail,
} from '@/server/services/email.service';

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/email.service', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue(true),
  sendWinemakerNewBookingEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@/lib/posthog', () => ({
  getPostHogServer: vi.fn(() => null),
}));

const mockDb = vi.mocked(db);
const mockSendBookingConfirmationEmail = vi.mocked(
  sendBookingConfirmationEmail
);
const mockSendWinemakerNewBookingEmail = vi.mocked(
  sendWinemakerNewBookingEmail
);

const paidSession = {
  id: 'cs_test_paid',
  metadata: {
    bookingId: 'booking-1',
    bookingReference: 'ENC-ABC123',
  },
  payment_status: 'paid',
  payment_intent: 'pi_test_123',
} as Stripe.Checkout.Session;

const unpaidSession = {
  ...paidSession,
  id: 'cs_test_unpaid',
  payment_status: 'unpaid',
  payment_intent: null,
} as Stripe.Checkout.Session;

const pendingBooking = {
  id: 'booking-1',
  reference: 'ENC-ABC123',
  visitorEmail: 'sam@example.com',
  visitorName: 'Sam',
  experienceId: 'experience-1',
  wineryId: 'winery-1',
  date: new Date('2026-05-26T00:00:00.000Z'),
  timeSlot: '14:00',
  guestCount: 4,
  totalPrice: 20000,
  platformFee: 2400,
  wineryPayout: 17600,
  status: BookingStatus.PENDING_PAYMENT,
  stripeCheckoutSessionId: 'cs_test_paid',
  experience: {
    title: 'Wine Tasting',
    duration: 90,
  },
  winery: {
    name: 'Domaine Germanier',
    email: 'winery@example.com',
    user: {
      name: 'Winemaker',
      preferredLocale: 'FR',
    },
  },
};

describe('confirmBookingFromPaidCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.booking.findUnique.mockResolvedValue(pendingBooking as never);
    mockDb.booking.updateMany.mockResolvedValue({ count: 1 } as never);
    mockDb.booking.update.mockResolvedValue({} as never);
  });

  it('confirms a pending booking when the Checkout Session is paid', async () => {
    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(
      paidSession,
      'confirmation_page'
    );

    expect(result).toBe('confirmed');
    expect(mockDb.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT },
      data: expect.objectContaining({
        status: BookingStatus.CONFIRMED,
        stripeCheckoutSessionId: 'cs_test_paid',
        stripePaymentIntentId: 'pi_test_123',
        expiresAt: null,
        accessTokenHash: expect.any(String),
      }),
    });
    expect(mockSendBookingConfirmationEmail).toHaveBeenCalledOnce();
    expect(mockSendWinemakerNewBookingEmail).toHaveBeenCalledOnce();
  });

  it('does not confirm a booking when the Checkout Session is not paid', async () => {
    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(unpaidSession);

    expect(result).toBe('not_paid');
    expect(mockDb.booking.findUnique).not.toHaveBeenCalled();
    expect(mockDb.booking.updateMany).not.toHaveBeenCalled();
    expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it('does not send emails when another caller already claimed the confirmation', async () => {
    mockDb.booking.updateMany.mockResolvedValue({ count: 0 } as never);

    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(
      paidSession,
      'webhook'
    );

    expect(result).toBe('race_lost');
    expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
    expect(mockSendWinemakerNewBookingEmail).not.toHaveBeenCalled();
  });

  it('refuses to confirm when the session does not match the booking', async () => {
    mockDb.booking.findUnique.mockResolvedValue({
      ...pendingBooking,
      stripeCheckoutSessionId: 'cs_test_other',
    } as never);

    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(paidSession);

    expect(result).toBe('session_mismatch');
    expect(mockDb.booking.updateMany).not.toHaveBeenCalled();
    expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
  });
});
