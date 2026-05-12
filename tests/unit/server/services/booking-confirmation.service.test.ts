import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus } from '@prisma/client';

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@/server/services/email.service', () => ({
  sendBookingConfirmationEmail: vi.fn(),
  sendWinemakerNewBookingEmail: vi.fn(),
}));

vi.mock('@/lib/posthog', () => ({
  getPostHogServer: vi.fn(() => null),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import { db } from '@/server/db';
import { revalidateTag } from 'next/cache';
import {
  sendBookingConfirmationEmail,
  sendWinemakerNewBookingEmail,
} from '@/server/services/email.service';
import { confirmBookingFromCheckoutSession } from '@/server/services/booking-confirmation.service';

const BOOKING_ID = 'ckxyzabcdefghij1234567890';
const SESSION_ID = 'cs_test_abc123';
const PI_ID = 'pi_test_xyz789';

const baseBooking = {
  id: BOOKING_ID,
  reference: 'ENC-ABC123',
  visitorEmail: 'jane@example.com',
  visitorName: 'Jane Doe',
  timeSlot: '14:00',
  date: new Date('2026-06-14T00:00:00.000Z'),
  guestCount: 2,
  totalPrice: 9000,
  platformFee: 1080,
  wineryPayout: 7920,
  experienceId: 'exp_1',
  wineryId: 'win_1',
  // ENC-067 H1: explicit nulls so the email guard reads "not yet sent".
  confirmationSentAt: null,
  wineryNotifiedAt: null,
  experience: {
    title: 'Dégustation Pinot Noir',
    slug: 'degustation-pinot-noir',
    duration: 120,
  },
  winery: {
    name: 'Cave de la Tour',
    slug: 'cave-de-la-tour',
    email: 'cave@example.ch',
    user: {
      name: 'Marie',
      preferredLocale: 'FR' as const,
    },
  },
};

describe('confirmBookingFromCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: flips PENDING_PAYMENT → CONFIRMED, sends emails, invalidates tags', async () => {
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(db.booking.findUnique).mockResolvedValue(
      baseBooking as unknown as Awaited<
        ReturnType<typeof db.booking.findUnique>
      >
    );
    vi.mocked(db.booking.update).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof db.booking.update>>
    );
    vi.mocked(sendBookingConfirmationEmail).mockResolvedValue(true);
    vi.mocked(sendWinemakerNewBookingEmail).mockResolvedValue(true);

    const res = await confirmBookingFromCheckoutSession({
      bookingId: BOOKING_ID,
      stripeSessionId: SESSION_ID,
      stripePaymentIntentId: PI_ID,
      source: 'WEBHOOK',
    });

    expect(res).toEqual({ confirmed: true, alreadyConfirmed: false });

    // Atomic conditional update
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: BOOKING_ID, status: BookingStatus.PENDING_PAYMENT },
      data: expect.objectContaining({
        status: BookingStatus.CONFIRMED,
        stripePaymentIntentId: PI_ID,
        expiresAt: null,
      }),
    });

    // Emails
    expect(sendBookingConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(sendWinemakerNewBookingEmail).toHaveBeenCalledTimes(1);

    // Cache invalidation tags
    expect(revalidateTag).toHaveBeenCalledWith(`booking:${BOOKING_ID}`);
    expect(revalidateTag).toHaveBeenCalledWith(
      `booking:winery:${baseBooking.winery.slug}`
    );
    expect(revalidateTag).toHaveBeenCalledWith(
      `experience:${baseBooking.experience.slug}:availability`
    );
  });

  it('race-loser: updateMany returns count=0, no emails, no cache invalidation', async () => {
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 0 });

    const res = await confirmBookingFromCheckoutSession({
      bookingId: BOOKING_ID,
      stripeSessionId: SESSION_ID,
      stripePaymentIntentId: PI_ID,
      source: 'RECONCILE',
    });

    expect(res).toEqual({ confirmed: false, alreadyConfirmed: true });
    expect(db.booking.findUnique).not.toHaveBeenCalled();
    expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
    expect(sendWinemakerNewBookingEmail).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('H1: skips both emails when confirmationSentAt and wineryNotifiedAt are already set', async () => {
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      ...baseBooking,
      confirmationSentAt: new Date('2026-06-13T10:00:00.000Z'),
      wineryNotifiedAt: new Date('2026-06-13T10:00:00.000Z'),
    } as unknown as Awaited<ReturnType<typeof db.booking.findUnique>>);
    vi.mocked(db.booking.update).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof db.booking.update>>
    );

    const res = await confirmBookingFromCheckoutSession({
      bookingId: BOOKING_ID,
      stripeSessionId: SESSION_ID,
      stripePaymentIntentId: PI_ID,
      source: 'RECONCILE',
    });

    expect(res).toEqual({ confirmed: true, alreadyConfirmed: false });
    // Both emails skipped.
    expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
    expect(sendWinemakerNewBookingEmail).not.toHaveBeenCalled();
    // No timestamp updates fired either.
    expect(db.booking.update).not.toHaveBeenCalled();
  });

  it('already confirmed: a second WEBHOOK call after a successful RECONCILE is a no-op', async () => {
    // Simulate the "already confirmed" path: the row's status is no longer
    // PENDING_PAYMENT, so updateMany returns count=0.
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 0 });

    const res = await confirmBookingFromCheckoutSession({
      bookingId: BOOKING_ID,
      stripeSessionId: SESSION_ID,
      stripePaymentIntentId: PI_ID,
      source: 'WEBHOOK',
    });

    expect(res.confirmed).toBe(false);
    expect(res.alreadyConfirmed).toBe(true);
    // No side-effects fired.
    expect(sendBookingConfirmationEmail).not.toHaveBeenCalled();
    expect(sendWinemakerNewBookingEmail).not.toHaveBeenCalled();
  });
});
