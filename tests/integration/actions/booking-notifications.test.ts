import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { db } from '@/server/db';
import { BookingStatus, UserRole } from '@prisma/client';

// Mock db
vi.mock('@/server/db', () => ({
  db: {
    booking: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock email service
vi.mock('@/server/services/email.service', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue(true),
}));

import { auth } from '@/server/auth';

describe('Booking Notification Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'client-1',
        email: 'john@example.com',
        role: UserRole.CLIENT,
      },
    } as never);
  });

  describe('getBookingByToken', () => {
    const accessToken = 'test-access-token-12345';
    const tokenHash = crypto
      .createHash('sha256')
      .update(accessToken)
      .digest('hex');

    const mockBooking = {
      id: 'booking-1',
      reference: 'ENC-XYZ789',
      status: BookingStatus.CONFIRMED,
      visitorName: 'Jane Doe',
      visitorEmail: 'jane@example.com',
      visitorPhone: '+41791234567',
      date: new Date('2026-04-20'),
      timeSlot: '10:00',
      guestCount: 2,
      totalPrice: 10000,
      accessToken,
      accessTokenHash: tokenHash,
      experience: {
        title: 'Cellar Visit',
        slug: 'cellar-visit',
        duration: 60,
        coverPhoto: 'https://example.com/photo.jpg',
      },
      winery: {
        name: 'Test Winery',
        slug: 'test-winery',
        address: '123 Wine St',
        commune: 'Sion',
        phone: '+41271234567',
        email: 'winery@example.com',
      },
    };

    it('returns booking for valid token', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(mockBooking as never);

      const { getBookingByToken } = await import('@/server/actions/booking');
      const result = await getBookingByToken(accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reference).toBe('ENC-XYZ789');
        expect(result.data.visitorName).toBe('Jane Doe');
      }
    });

    it('searches by SHA-256 token hash', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(mockBooking as never);

      const { getBookingByToken } = await import('@/server/actions/booking');
      await getBookingByToken(accessToken);

      expect(db.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accessTokenHash: tokenHash,
          },
        })
      );
    });

    it('returns NOT_FOUND for invalid token', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(null);

      const { getBookingByToken } = await import('@/server/actions/booking');
      const result = await getBookingByToken('invalid-token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('includes all booking details in response', async () => {
      vi.mocked(db.booking.findFirst).mockResolvedValue(mockBooking as never);

      const { getBookingByToken } = await import('@/server/actions/booking');
      const result = await getBookingByToken(accessToken);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.experience.title).toBe('Cellar Visit');
        expect(result.data.winery.name).toBe('Test Winery');
        expect(result.data.winery.address).toBe('123 Wine St');
      }
    });
  });
});
