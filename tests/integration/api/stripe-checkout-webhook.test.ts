import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, Locale } from '@prisma/client';

const constructEventMock = vi.fn();

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => (name === 'stripe-signature' ? 'sig_test' : null),
  })),
}));

vi.mock('@/server/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEvent: constructEventMock },
  }),
  isStripeConfigured: () => true,
}));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/email.service', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue(true),
  sendWinemakerNewBookingEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/env', () => ({
  env: { STRIPE_WEBHOOK_SECRET: 'whsec_test' },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock('@/lib/posthog', () => ({
  getPostHogServer: () => null,
}));

const { db } = await import('@/server/db');
const { sendBookingConfirmationEmail, sendWinemakerNewBookingEmail } =
  await import('@/server/services/email.service');
const { POST } = await import('@/app/api/webhooks/stripe/checkout/route');

function request() {
  return new Request('http://localhost/api/webhooks/stripe/checkout', {
    method: 'POST',
    body: '{}',
  });
}

function pendingBooking() {
  return {
    id: 'booking-1',
    reference: 'ENC-ABC123',
    status: BookingStatus.PENDING_PAYMENT,
    visitorName: 'Alice',
    visitorEmail: 'alice@test.ch',
    guestCount: 2,
    totalPrice: 10000,
    platformFee: 1200,
    wineryPayout: 8800,
    experienceId: 'exp-1',
    wineryId: 'winery-1',
    date: new Date('2026-06-15T00:00:00.000Z'),
    timeSlot: '10:00',
    experience: { title: 'Atelier pinot', duration: 90 },
    winery: {
      name: 'Cave Test',
      email: 'owner@test.ch',
      user: { name: 'Owner', preferredLocale: Locale.FR },
    },
  };
}

describe('Stripe checkout webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms a pending booking on checkout.session.completed and sends emails', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { bookingId: 'booking-1' },
          payment_intent: 'pi_test_123',
        },
      },
    });
    vi.mocked(db.booking.findUnique).mockResolvedValue(pendingBooking());
    vi.mocked(db.booking.update).mockResolvedValue({} as never);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: expect.objectContaining({
        status: BookingStatus.CONFIRMED,
        stripePaymentIntentId: 'pi_test_123',
        expiresAt: null,
        accessTokenHash: expect.any(String),
      }),
    });
    expect(sendBookingConfirmationEmail).toHaveBeenCalledWith(
      'alice@test.ch',
      expect.objectContaining({
        bookingId: 'booking-1',
        accessToken: expect.any(String),
        bookingRef: 'ENC-ABC123',
      })
    );
    expect(sendWinemakerNewBookingEmail).toHaveBeenCalledWith(
      'owner@test.ch',
      expect.objectContaining({ bookingRef: 'ENC-ABC123' }),
      Locale.FR
    );
  });

  it('is idempotent when checkout.session.completed arrives twice', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { bookingId: 'booking-1' },
          payment_intent: 'pi_test_123',
        },
      },
    });
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...pendingBooking(),
      status: BookingStatus.CONFIRMED,
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(db.booking.update).not.toHaveBeenCalled();
    expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it('deletes an expired pending checkout to free capacity', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.expired',
      data: { object: { metadata: { bookingId: 'booking-1' } } },
    });
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      id: 'booking-1',
      reference: 'ENC-ABC123',
      status: BookingStatus.PENDING_PAYMENT,
    });
    vi.mocked(db.booking.delete).mockResolvedValue({} as never);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(db.booking.delete).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
    });
  });
});
