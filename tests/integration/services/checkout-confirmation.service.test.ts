import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { BookingStatus } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/server/db';
import { getPostHogServer } from '@/lib/posthog';
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

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
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

    expect(result.result).toBe('confirmed');
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

    // The guest email must carry the plaintext access token whose SHA-256
    // hash was persisted — this is what makes the magic ticket link work.
    const emailData = mockSendBookingConfirmationEmail.mock.calls[0]?.[1] as {
      bookingId?: string;
      accessToken?: string;
    };
    expect(emailData.bookingId).toBe('booking-1');
    expect(emailData.accessToken).toEqual(expect.any(String));
    const persisted = mockDb.booking.updateMany.mock.calls[0]?.[0] as {
      data: { accessTokenHash: string };
    };
    const crypto = await import('crypto');
    const expectedHash = crypto
      .createHash('sha256')
      .update(emailData.accessToken ?? '')
      .digest('hex');
    expect(persisted.data.accessTokenHash).toBe(expectedHash);
    // The outcome exposes the same plaintext token for the on-screen QR.
    expect(result.accessToken).toBe(emailData.accessToken);
  });

  it('does not confirm a booking when the Checkout Session is not paid', async () => {
    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(unpaidSession);

    expect(result.result).toBe('not_paid');
    expect(mockDb.booking.findUnique).not.toHaveBeenCalled();
    expect(mockDb.booking.updateMany).not.toHaveBeenCalled();
    expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it('does not send emails when another caller already claimed the confirmation — and says the booking IS confirmed', async () => {
    mockDb.booking.updateMany.mockResolvedValue({ count: 0 } as never);
    // The confirmation page won the CAS between our read and our update:
    // the re-read sees CONFIRMED. The caller must know (the sur-mesure
    // offer still has to flip to PAID, the gift transfer to settle).
    mockDb.booking.findUnique
      .mockResolvedValueOnce(pendingBooking as never)
      .mockResolvedValueOnce({ status: BookingStatus.CONFIRMED } as never);

    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(
      paidSession,
      'webhook'
    );

    expect(result.result).toBe('already_confirmed');
    expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
    expect(mockSendWinemakerNewBookingEmail).not.toHaveBeenCalled();
  });

  it('reports not_pending when the lost race was a CANCELLATION (the caller refunds the orphan charge)', async () => {
    mockDb.booking.updateMany.mockResolvedValue({ count: 0 } as never);
    mockDb.booking.findUnique
      .mockResolvedValueOnce(pendingBooking as never)
      .mockResolvedValueOnce({
        status: BookingStatus.CANCELLED_BY_WINERY,
      } as never);

    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(
      paidSession,
      'webhook'
    );

    expect(result.result).toBe('not_pending');
    expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  describe('paid amount cross-check', () => {
    // 200.00 tickets + 10.00 service fee − 50.00 gift = 160.00 on the card.
    const bookingWithMoney = {
      ...pendingBooking,
      serviceFeeCents: 1000,
      giftAppliedCents: 5000,
    };
    const sessionPaying = (amountTotal: number, currency = 'chf') =>
      ({
        ...paidSession,
        amount_total: amountTotal,
        currency,
      }) as Stripe.Checkout.Session;

    beforeEach(() => {
      mockDb.booking.findUnique.mockResolvedValue(bookingWithMoney as never);
    });

    it('confirms when the session charged exactly what the booking owes', async () => {
      const { confirmBookingFromPaidCheckoutSession } =
        await import('@/server/services/checkout-confirmation.service');

      const result = await confirmBookingFromPaidCheckoutSession(
        sessionPaying(16000)
      );

      expect(result.result).toBe('confirmed');
    });

    it('does NOT confirm when the paid amount differs — amount_mismatch, no status change, no email', async () => {
      const { confirmBookingFromPaidCheckoutSession } =
        await import('@/server/services/checkout-confirmation.service');

      const result = await confirmBookingFromPaidCheckoutSession(
        sessionPaying(21000)
      );

      expect(result.result).toBe('amount_mismatch');
      expect(mockDb.booking.updateMany).not.toHaveBeenCalled();
      expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
    });

    it('skips the check for a non-CHF total (presentment currency) and for events without amount_total', async () => {
      const { confirmBookingFromPaidCheckoutSession } =
        await import('@/server/services/checkout-confirmation.service');

      const foreign = await confirmBookingFromPaidCheckoutSession(
        sessionPaying(17250, 'eur')
      );
      const synthetic =
        await confirmBookingFromPaidCheckoutSession(paidSession);

      expect(foreign.result).toBe('confirmed');
      expect(synthetic.result).toBe('confirmed');
    });
  });

  it('refuses to confirm when the session does not match the booking', async () => {
    mockDb.booking.findUnique.mockResolvedValue({
      ...pendingBooking,
      stripeCheckoutSessionId: 'cs_test_other',
    } as never);

    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(paidSession);

    expect(result.result).toBe('session_mismatch');
    expect(mockDb.booking.updateMany).not.toHaveBeenCalled();
    expect(mockSendBookingConfirmationEmail).not.toHaveBeenCalled();
  });
});

describe('confirmation side effects (emails + analytics)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.booking.findUnique.mockResolvedValue(pendingBooking as never);
    mockDb.booking.updateMany.mockResolvedValue({ count: 1 } as never);
    mockDb.booking.update.mockResolvedValue({} as never);
    mockSendBookingConfirmationEmail.mockResolvedValue(true);
    mockSendWinemakerNewBookingEmail.mockResolvedValue(true);
    vi.mocked(getPostHogServer).mockReturnValue(null);
  });

  it('stamps confirmationSentAt / wineryNotifiedAt only when the emails were really sent', async () => {
    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    await confirmBookingFromPaidCheckoutSession(paidSession, 'webhook');

    const stamped = mockDb.booking.update.mock.calls.map(
      (call) => Object.keys(call[0].data)[0]
    );
    expect(stamped).toEqual(['confirmationSentAt', 'wineryNotifiedAt']);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('does NOT stamp confirmationSentAt and alerts (area:email) when the client email was not sent', async () => {
    // sendEmail resolves false — it does not throw — when Resend refused
    // the message or the key is missing in production.
    mockSendBookingConfirmationEmail.mockResolvedValue(false);
    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(
      paidSession,
      'webhook'
    );

    // The booking is paid and stays confirmed — only the stamp is withheld.
    expect(result.result).toBe('confirmed');
    const stamped = mockDb.booking.update.mock.calls.map(
      (call) => Object.keys(call[0].data)[0]
    );
    expect(stamped).toEqual(['wineryNotifiedAt']);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tags: { area: 'email', email: 'client_confirmation' },
        extra: expect.objectContaining({ bookingId: 'booking-1' }),
      })
    );
  });

  it('alerts when the client email throws, and still notifies the winery', async () => {
    mockSendBookingConfirmationEmail.mockRejectedValue(
      new Error('render failed')
    );
    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const result = await confirmBookingFromPaidCheckoutSession(
      paidSession,
      'webhook'
    );

    expect(result.result).toBe('confirmed');
    expect(mockSendWinemakerNewBookingEmail).toHaveBeenCalledOnce();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tags: { area: 'email', email: 'client_confirmation' },
      })
    );
  });

  it('never waits on (or fails because of) the PostHog flush', async () => {
    const capture = vi.fn();
    // A flush that rejects — and, in the other failure mode, one that never
    // settles — must leave the confirmation and its emails untouched.
    const flush = vi
      .fn()
      .mockReturnValueOnce(Promise.reject(new Error('posthog down')))
      .mockReturnValueOnce(new Promise(() => {}));
    vi.mocked(getPostHogServer).mockReturnValue({ capture, flush } as never);
    const { confirmBookingFromPaidCheckoutSession } =
      await import('@/server/services/checkout-confirmation.service');

    const rejected = await confirmBookingFromPaidCheckoutSession(
      paidSession,
      'webhook'
    );
    const hanging = await confirmBookingFromPaidCheckoutSession(
      paidSession,
      'webhook'
    );

    expect(rejected.result).toBe('confirmed');
    expect(hanging.result).toBe('confirmed');
    expect(capture).toHaveBeenCalledTimes(2);

    // No consent signal server-side: never the visitor's email as the
    // PostHog identity, no person profile, nothing that names a person.
    const event = capture.mock.calls[0]?.[0] as {
      distinctId: string;
      properties: Record<string, unknown>;
    };
    expect(event.distinctId).toMatch(/^booking_[0-9a-f]{32}$/);
    expect(event.distinctId).not.toContain('@');
    expect(event.properties.$process_person_profile).toBe(false);
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(pendingBooking.visitorEmail);
    expect(serialized).not.toContain(pendingBooking.reference);
    expect(serialized).not.toContain(pendingBooking.id);
    expect(mockSendBookingConfirmationEmail).toHaveBeenCalledTimes(2);
  });
});
