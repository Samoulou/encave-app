import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus, Locale } from '@prisma/client';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    experience: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const refundCreateMock = vi.fn();
const checkoutExpireMock = vi.fn();
vi.mock('@/server/stripe', () => ({
  getStripe: () => ({
    refunds: { create: refundCreateMock },
    checkout: { sessions: { expire: checkoutExpireMock } },
  }),
}));

vi.mock('@/server/services/email.service', () => ({
  sendBookingCancelledByWineryEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { sendBookingCancelledByWineryEmail } =
  await import('@/server/services/email.service');
const { logError } = await import('@/lib/logger');
const { cancelEventSession } = await import('@/server/actions/event-detail');

const experienceId = 'ckeventsession123456789012345';

const winemakerSession: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: Locale.FR,
  },
};

function mockExperience() {
  vi.mocked(db.experience.findUnique).mockResolvedValue({
    id: experienceId,
    slug: 'atelier-pinot',
    title: 'Atelier pinot',
    duration: 90,
    winery: {
      userId: 'owner-1',
      name: 'Cave Test',
      user: { preferredLocale: Locale.FR },
    },
  } as never);
}

describe('cancelEventSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(winemakerSession);
    mockExperience();
    refundCreateMock.mockResolvedValue({ id: 're_session_123' });
    checkoutExpireMock.mockResolvedValue({});
    vi.mocked(db.booking.update).mockResolvedValue({} as never);
  });

  it('cancels confirmed and pending bookings, refunds paid bookings and sends emails', async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'booking-confirmed',
        reference: 'ENC-PAID',
        visitorEmail: 'paid@test.ch',
        visitorName: 'Alice',
        guestCount: 2,
        totalPrice: 10000,
        status: BookingStatus.CONFIRMED,
        stripePaymentIntentId: 'pi_paid_123',
      },
      {
        id: 'booking-pending',
        reference: 'ENC-PENDING',
        visitorEmail: 'pending@test.ch',
        visitorName: 'Bob',
        guestCount: 1,
        totalPrice: 5000,
        status: BookingStatus.PENDING_PAYMENT,
        stripePaymentIntentId: 'cs_pending_123',
      },
    ] as never);

    const result = await cancelEventSession({
      experienceId,
      sessionId: '2026-06-15|10:00',
      reason: 'Orage violent sur le domaine',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ cancelled: 2, refunded: 10000, failed: 0 });
    }
    expect(refundCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: 'pi_paid_123',
        amount: 10000,
      }),
      expect.objectContaining({
        idempotencyKey: 'winery-session-cancel:booking-confirmed:10000',
      })
    );
    expect(checkoutExpireMock).toHaveBeenCalledWith('cs_pending_123');
    expect(db.booking.update).toHaveBeenCalledTimes(2);
    expect(sendBookingCancelledByWineryEmail).toHaveBeenCalledTimes(2);
  });

  it('stores refundError and continues when Stripe refund fails', async () => {
    refundCreateMock.mockRejectedValue(new Error('Stripe refund failed'));
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: 'booking-confirmed',
        reference: 'ENC-PAID',
        visitorEmail: 'paid@test.ch',
        visitorName: 'Alice',
        guestCount: 2,
        totalPrice: 10000,
        status: BookingStatus.CONFIRMED,
        stripePaymentIntentId: 'pi_paid_123',
      },
    ] as never);

    const result = await cancelEventSession({
      experienceId,
      sessionId: '2026-06-15|10:00',
      reason: 'Orage violent sur le domaine',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ cancelled: 0, refunded: 0, failed: 1 });
    }
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-confirmed' },
      data: { refundError: 'Error: Stripe refund failed' },
    });
    expect(logError).toHaveBeenCalledWith(
      'cancelEventSession booking failed',
      expect.any(Error),
      expect.objectContaining({ bookingId: 'booking-confirmed' })
    );
  });
});
