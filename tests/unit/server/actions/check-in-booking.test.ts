import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';
import type { Session } from '@/server/auth';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/rate-limit.service', () => ({
  API_RATE_LIMIT: { maxRequests: 60, windowMs: 60_000 },
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    remaining: 59,
    resetAt: Date.now() + 60_000,
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const { auth } = await import('@/server/auth');
const { db } = await import('@/server/db');
const { checkInBooking } = await import('@/server/actions/checkInBooking');

const session: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@test.ch',
    name: 'Owner',
    role: 'WINEMAKER',
    preferredLocale: 'FR',
  },
};

const booking = {
  id: 'booking-1',
  reference: 'ENC-ABC123',
  visitorName: 'Alice Test',
  guestCount: 2,
  status: BookingStatus.CONFIRMED,
  checkedInAt: null,
  date: new Date('2026-05-20T00:00:00Z'),
  timeSlot: '10:00',
  experience: {
    id: 'experience-1',
    title: 'Atelier pinot',
    slug: 'atelier-pinot',
    winery: { userId: 'owner-1' },
  },
};

describe('checkInBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(session);
  });

  it('checks in a confirmed booking from a scanned token', async () => {
    vi.mocked(db.booking.findFirst).mockResolvedValue(booking as never);
    vi.mocked(db.booking.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.booking.findUnique).mockResolvedValue({
      id: 'booking-1',
      reference: 'ENC-ABC123',
      visitorName: 'Alice Test',
      guestCount: 2,
      status: BookingStatus.COMPLETED,
      checkedInAt: new Date('2026-05-19T12:00:00Z'),
    } as never);

    const result = await checkInBooking({
      token: 'a'.repeat(64),
      expectedSessionId: '2026-05-20|10:00',
      source: 'scan',
    });

    expect(result.success).toBe(true);
    expect(db.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1', status: BookingStatus.CONFIRMED },
        data: expect.objectContaining({ status: BookingStatus.COMPLETED }),
      })
    );
  });

  it('returns a structured error for cancelled bookings', async () => {
    vi.mocked(db.booking.findFirst).mockResolvedValue({
      ...booking,
      status: BookingStatus.CANCELLED_BY_CLIENT,
    } as never);

    const result = await checkInBooking({ token: 'a'.repeat(64) });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BOOKING_CANCELLED');
    }
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });
});
